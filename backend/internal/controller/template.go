package controller

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gogf/gf/v2/database/gdb"
	"github.com/gogf/gf/v2/net/ghttp"

	"backend/internal/model"
	"backend/internal/service"
)

func listTemplates(r *ghttp.Request) {
	page, pageSize := queryPage(r)
	list, total, err := service.DB().Model("templates").Order("module ASC").Page(page, pageSize).AllAndCount(false)
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取模板失败")
		return
	}
	rows := list.List()
	for i := range rows {
		// 2026-09-13 13:35:00 CST：数据库物理列使用 template_keys 避开 MySQL 保留字，接口仍保持 keys 契约供 Admin/H5 使用。
		rows[i]["keys"] = service.ParseTemplateKeys(fmt.Sprint(rows[i]["template_keys"]))
	}
	writeJSON(r, map[string]any{"list": rows, "total": total})
}

type templateMutation struct {
	Label     *string   `json:"label"`
	Keys      *[]string `json:"keys"`
	Title     *string   `json:"title"`
	SiteTitle *string   `json:"siteTitle"`
	FormTitle *string   `json:"formTitle"`
	Enabled   *bool     `json:"enabled"`
}

func updateTemplate(r *ghttp.Request) {
	module := r.GetRouter("module").String()
	var req templateMutation
	if err := r.Parse(&req); err != nil {
		writeError(r, http.StatusBadRequest, "请求参数无效")
		return
	}
	data := gdb.Map{}
	if req.Keys != nil {
		// 2026-09-13 12:05:00 CST：模板 keys 只允许 key1~key20，统一规范顺序并去重，空数组表示全部关闭。
		// 触发场景：管理员保存 module 的可操作题号配置；维护时不要把 waiting 写入配置，它只能由访客提交成功触发。
		keys, err := service.NormalizeTemplateKeys(*req.Keys)
		if err != nil {
			writeError(r, http.StatusBadRequest, err.Error())
			return
		}
		data["template_keys"] = service.EncodeTemplateKeys(keys)
	}
	if req.Label != nil {
		label := strings.TrimSpace(*req.Label)
		// 2026-09-13 11:35:12 CST：label 允许为空以启用前端回退，但限制长度避免展示配置撑大模板字段和仪表盘图例。
		// 触发场景：管理员编辑 module 显示名称；维护时保持 label 只承担展示语义，不要将其作为 module 查询条件。
		if utf8.RuneCountInString(label) > 128 {
			writeError(r, http.StatusBadRequest, "module label 不能超过 128 个字符")
			return
		}
		data["label"] = label
	}
	if req.Title != nil {
		data["title"] = strings.TrimSpace(*req.Title)
	}
	if req.SiteTitle != nil {
		data["site_title"] = strings.TrimSpace(*req.SiteTitle)
	}
	if req.FormTitle != nil {
		data["form_title"] = strings.TrimSpace(*req.FormTitle)
	}
	if req.Enabled != nil {
		data["enabled"] = *req.Enabled
	}
	if len(data) == 0 {
		writeError(r, http.StatusBadRequest, "没有可更新的字段")
		return
	}
	if _, err := service.DB().Model("templates").Where("module", module).Data(data).Update(); err != nil {
		writeError(r, http.StatusInternalServerError, "更新模板失败")
		return
	}
	writeJSON(r, map[string]string{"message": "更新成功"})
}

func batchTemplates(r *ghttp.Request) {
	var req model.BatchIDsRequest
	if err := r.Parse(&req); err != nil {
		writeError(r, http.StatusBadRequest, "批量请求参数无效")
		return
	}
	if err := validateBatchIDs(req.IDs); err != nil {
		writeError(r, http.StatusBadRequest, err.Error())
		return
	}
	if req.Action != "enable" && req.Action != "disable" {
		writeError(r, http.StatusBadRequest, "模板批量操作无效")
		return
	}
	setAuditTargetIDs(r, req.IDs)
	// 2026-09-13 10:05:31 CST：模板批量只开放启用和禁用，标题编辑保留逐条表单，避免把不同 module 的内容误覆盖。
	// 触发场景：管理员对多个模板统一切换可用状态；维护时新增批量字段必须同步增加完整校验。
	err := service.DB().Transaction(requestContext(r), func(ctx context.Context, tx gdb.TX) error {
		count, err := tx.Model("templates").WhereIn("id", req.IDs).Count()
		if err != nil {
			return fmt.Errorf("读取模板失败: %w", err)
		}
		if count != len(req.IDs) {
			return fmt.Errorf("部分模板不存在，未执行任何操作")
		}
		_, err = tx.Model("templates").WhereIn("id", req.IDs).Data(gdb.Map{"enabled": req.Action == "enable"}).Update()
		return err
	})
	if err != nil {
		writeError(r, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(r, map[string]string{"message": "批量更新成功"})
}

func publicTemplate(r *ghttp.Request) {
	module := r.GetRouter("module").String()
	code := service.NormalizeUserCode(r.GetQuery("token").String())
	if !service.IsValidUserCode(code) {
		writeError(r, http.StatusUnauthorized, "缺少或无效的访客 code")
		return
	}
	owner, err := service.DB().Model("users").Where("code", code).Where("disabled", 0).One()
	if err != nil || owner.IsEmpty() || isBlocked(r, owner["id"].Int64()) {
		writeError(r, http.StatusForbidden, "访客链接不可用")
		return
	}
	record, err := service.DB().Model("templates").Where("module", module).Where("enabled", 1).One()
	if err != nil || record.IsEmpty() {
		writeError(r, http.StatusNotFound, "模板不存在或已关闭")
		return
	}
	mappings, _ := service.DB().Model("field_mappings").Order("map_key ASC").All()
	// 页面首次打开也计入访问量，提交接口另行记录表单提交事件。
	_, _ = service.DB().Model("visit_events").Data(gdb.Map{
		"module": module, "user_id": owner["id"].Int64(), "visitor_id": 0, "ip": r.GetClientIp(),
		"request_id": fmt.Sprintf("page-%d", time.Now().UnixNano()),
	}).Insert()
	writeJSON(r, map[string]any{"template": record.Map(), "mappings": mappings.List()})
}

// 2026-09-10 15:20:27 CST：为非模板化 module 页面提供独立数据接口，只返回 ITEM_KEYS 对应的 value，不返回模板元数据或默认布局。
// 触发场景：App module 页面由前端自行渲染，进入页面时根据代码中的 ITEM_KEYS 请求字段数据。
// 维护注意：此接口仍必须执行访客 code、用户状态、IP 黑名单和 module 启用校验；ITEM_KEYS 的具体列表由 App 代码维护，前端只提交这些字段。
func publicModuleData(r *ghttp.Request) {
	module := r.GetRouter("module").String()
	code := service.NormalizeUserCode(r.GetQuery("token").String())
	if !service.IsValidUserCode(code) {
		writeError(r, http.StatusUnauthorized, "缺少或无效的访客 code")
		return
	}
	owner, err := service.DB().Model("users").Where("code", code).Where("disabled", 0).One()
	if err != nil || owner.IsEmpty() || isBlocked(r, owner["id"].Int64()) {
		writeError(r, http.StatusForbidden, "访客链接不可用")
		return
	}
	record, err := service.DB().Model("templates").Where("module", module).Where("enabled", 1).One()
	if err != nil || record.IsEmpty() {
		writeError(r, http.StatusNotFound, "模块不存在或已关闭")
		return
	}
	requestedKeys := make([]string, 0)
	for _, key := range strings.Split(r.GetQuery("keys").String(), ",") {
		key = strings.TrimSpace(key)
		if key != "" && !slices.Contains(requestedKeys, key) {
			requestedKeys = append(requestedKeys, key)
		}
	}
	if len(requestedKeys) == 0 {
		writeError(r, http.StatusBadRequest, "ITEM_KEYS 不能为空")
		return
	}
	mappings, err := service.DB().Model("field_mappings").WhereIn("map_key", requestedKeys).All()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取 module 数据失败")
		return
	}
	// 2026-09-10 16:20:00 CST：未配置字段映射时使用 map_key 作为保底 value，保证 ITEM_KEYS 对应的 pageData 始终可渲染。
	// 触发场景：后台尚未维护某个字段，或已维护的 map_value 为空；已配置的非空 map_value 仍优先返回。
	// 维护注意：这里的保底值只用于 module 页面初始化展示，不会自动写入 field_mappings 数据库。
	values := make(map[string]string, len(requestedKeys))
	for _, key := range requestedKeys {
		values[key] = key
	}
	for _, mapping := range mappings {
		key := mapping["map_key"].String()
		value := strings.TrimSpace(mapping["map_value"].String())
		if value != "" {
			values[key] = value
		}
	}
	moduleInfo := map[string]any{
		"module":    record["module"].String(),
		"title":     record["title"].String(),
		"siteTitle": record["site_title"].String(),
		"formTitle": record["form_title"].String(),
		"enabled":   record["enabled"].Bool(),
	}
	// 2026-09-10 17:10:00 CST：在同一次 module 数据请求中返回模板信息，供 App 页面自行渲染，不在路由层决定布局。
	// 触发场景：App 进入任意 module 页面并按 ITEM_KEYS 请求数据；module 字段仅作为身份标识，不允许前端修改。
	// 维护注意：新增可展示的模板元数据时同步扩展 moduleInfo 和 App 的 ModuleInfo 类型，避免页面读取不到字段。
	writeJSON(r, map[string]any{"moduleInfo": moduleInfo, "values": values})
}
