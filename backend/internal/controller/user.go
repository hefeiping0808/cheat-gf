package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gogf/gf/v2/database/gdb"
	"github.com/gogf/gf/v2/net/ghttp"

	"backend/internal/consts"
	"backend/internal/model"
	"backend/internal/service"
)

const maxRegularUsers = 5

var errUserLimitReached = errors.New("regular user limit reached")

type userMutation struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Disabled *bool  `json:"disabled"`
}

type userUpdateMutation struct {
	Username *string `json:"username"`
	Password string  `json:"password"`
	Disabled *bool   `json:"disabled"`
}

func listUsers(r *ghttp.Request) {
	page, pageSize := queryPage(r)
	m := service.DB().Model("users").Fields("id,username,code,role,disabled,created_at,updated_at").Page(page, pageSize).Order("id DESC")
	list, total, err := m.AllAndCount(false)
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取用户失败")
		return
	}
	items := make([]map[string]any, 0, len(list))
	for _, record := range list {
		items = append(items, userRecord(record))
	}
	writeJSON(r, map[string]any{"list": items, "total": total})
}

func createUser(r *ghttp.Request) {
	var req userMutation
	if err := r.Parse(&req); err != nil || strings.TrimSpace(req.Username) == "" {
		writeError(r, http.StatusBadRequest, "用户名不能为空")
		return
	}
	if req.Password == "" {
		req.Password = "123456"
	}
	hash, err := service.HashPassword(req.Password)
	if err != nil {
		writeError(r, http.StatusInternalServerError, "生成密码失败")
		return
	}
	// 2026-10-02 00:29:01 CST：新增普通用户前在事务中锁定管理员记录，再统计现存普通用户，限制最多 5 个并发安全。
	// 触发场景：管理员通过接口新增账户；固定管理员行作为互斥点，避免两个并发请求都读到剩余名额。
	// 维护注意：管理员不计入上限，删除普通用户会释放名额；角色必须在后端固定，不能采用客户端传值。
	err = service.DB().Transaction(requestContext(r), func(ctx context.Context, tx gdb.TX) error {
		admin, lockErr := tx.GetOne("SELECT id FROM users WHERE role = ? ORDER BY id ASC LIMIT 1 FOR UPDATE", consts.RoleAdmin)
		if lockErr != nil {
			return fmt.Errorf("lock user capacity: %w", lockErr)
		}
		if admin.IsEmpty() {
			return errors.New("administrator row missing while locking user capacity")
		}
		count, countErr := tx.Model("users").Where("role", consts.RoleUser).Count()
		if countErr != nil {
			return fmt.Errorf("count regular users: %w", countErr)
		}
		if count >= maxRegularUsers {
			return errUserLimitReached
		}
		var insertErr error
		for attempt := 0; attempt < 5; attempt++ {
			code, codeErr := service.GenerateUserCode()
			if codeErr != nil {
				return fmt.Errorf("generate user code: %w", codeErr)
			}
			_, insertErr = tx.Model("users").Data(gdb.Map{"username": strings.TrimSpace(req.Username), "code": code, "password": hash, "role": consts.RoleUser}).Insert()
			if insertErr == nil {
				return nil
			}
		}
		return insertErr
	})
	if errors.Is(err, errUserLimitReached) {
		writeErrorCode(r, http.StatusConflict, "USER_LIMIT_REACHED")
		return
	}
	if err != nil {
		writeError(r, http.StatusConflict, "用户名已存在或保存失败")
		return
	}
	writeJSON(r, map[string]string{"message": "创建成功"})
}

func updateUser(r *ghttp.Request) {
	id, ok := parseID(r, "id")
	if !ok {
		writeError(r, http.StatusBadRequest, "用户编号无效")
		return
	}
	setAuditTargetUser(r, id)
	target, err := service.DB().Model("users").Fields("role").Where("id", id).One()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取用户失败")
		return
	}
	if target.IsEmpty() {
		writeError(r, http.StatusNotFound, "用户不存在")
		return
	}
	// 2026-09-10 11:51:06 CST：管理员账号由系统维护，不允许通过管理端修改；该校验必须保留在后端，不能只依赖前端隐藏按钮。
	if target["role"].String() == consts.RoleAdmin {
		writeErrorCode(r, http.StatusForbidden, "USER_ADMIN_READONLY")
		return
	}
	var req userUpdateMutation
	if err := r.Parse(&req); err != nil {
		writeError(r, http.StatusBadRequest, "请求参数无效")
		return
	}
	if req.Username != nil {
		writeErrorCode(r, http.StatusBadRequest, "USERNAME_READONLY")
		return
	}
	data := gdb.Map{}
	if req.Disabled != nil {
		data["disabled"] = *req.Disabled
	}
	if req.Password != "" {
		hash, _ := service.HashPassword(req.Password)
		data["password"] = hash
	}
	if len(data) == 0 {
		writeError(r, http.StatusBadRequest, "没有可更新的字段")
		return
	}
	_, err = service.DB().Model("users").Where("id", id).Data(data).Update()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "更新用户失败")
		return
	}
	writeJSON(r, map[string]string{"message": "更新成功"})
}

func deleteUser(r *ghttp.Request) {
	id, ok := parseID(r, "id")
	if !ok {
		writeError(r, http.StatusBadRequest, "用户编号无效")
		return
	}
	setAuditTargetUser(r, id)
	target, err := service.DB().Model("users").Fields("role").Where("id", id).One()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取用户失败")
		return
	}
	if target.IsEmpty() {
		writeError(r, http.StatusNotFound, "用户不存在")
		return
	}
	// 2026-09-10 22:32:32 CST：删除用户时后端再次禁止管理员账号，防止绕过管理端按钮直接调用删除接口。
	// 触发场景：管理员请求删除任意用户；维护时管理员保护必须保留在服务端，不能只依赖前端隐藏按钮。
	if target["role"].String() == consts.RoleAdmin {
		writeErrorCode(r, http.StatusForbidden, "USER_ADMIN_DELETE_FORBIDDEN")
		return
	}
	if id == userID(r) {
		writeError(r, http.StatusBadRequest, "不能删除当前登录用户")
		return
	}
	_, err = service.DB().Model("users").Where("id", id).Delete()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "删除用户失败")
		return
	}
	writeJSON(r, map[string]string{"message": "删除成功"})
}

func batchUsers(r *ghttp.Request) {
	var req model.BatchIDsRequest
	if err := r.Parse(&req); err != nil {
		writeError(r, http.StatusBadRequest, "批量请求参数无效")
		return
	}
	if err := validateBatchIDs(req.IDs); err != nil {
		writeError(r, http.StatusBadRequest, err.Error())
		return
	}
	if req.Action != "delete" && req.Action != "enable" && req.Action != "disable" {
		writeError(r, http.StatusBadRequest, "用户批量操作无效")
		return
	}
	setAuditTargetIDs(r, req.IDs)

	// 2026-09-13 10:05:31 CST：用户批量操作先锁定并校验全部目标，再在同一事务中更新或删除，任一目标不合法都会整体回滚。
	// 触发场景：管理员提交混合了管理员账号、当前账号或不存在 ID 的批量请求；维护时不能只依赖前端禁用选择。
	err := service.DB().Transaction(requestContext(r), func(ctx context.Context, tx gdb.TX) error {
		targets, err := tx.Model("users").Fields("id,role").WhereIn("id", req.IDs).All()
		if err != nil {
			return fmt.Errorf("读取用户失败: %w", err)
		}
		if len(targets) != len(req.IDs) {
			return fmt.Errorf("部分用户不存在，未执行任何操作")
		}
		for _, target := range targets {
			if target["role"].String() == consts.RoleAdmin {
				return fmt.Errorf("管理员账号不可批量操作")
			}
			if req.Action == "delete" && target["id"].Int64() == userID(r) {
				return fmt.Errorf("不能删除当前登录用户")
			}
		}
		if req.Action == "delete" {
			_, err = tx.Model("users").WhereIn("id", req.IDs).Delete()
		} else {
			_, err = tx.Model("users").WhereIn("id", req.IDs).Data(gdb.Map{"disabled": req.Action == "disable"}).Update()
		}
		return err
	})
	if err != nil {
		writeError(r, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(r, map[string]string{"message": "批量操作成功"})
}

func listUserOptions(r *ghttp.Request) {
	// 2026-09-10 11:38:06 CST：筛选器不提供管理员账号和“全部用户”选项，避免管理员业务数据被误选；路由层已要求管理员 token。
	list, err := service.DB().Model("users").Where("role", consts.RoleUser).Fields("id,username,role").Order("username ASC").All()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取用户选项失败")
		return
	}
	writeJSON(r, list.List())
}

var _ = model.User{}
