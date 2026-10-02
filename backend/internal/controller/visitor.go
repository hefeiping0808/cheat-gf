package controller

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gogf/gf/v2/database/gdb"
	"github.com/gogf/gf/v2/net/ghttp"

	"backend/internal/model"
	"backend/internal/service"
)

func createVisitorLink(r *ghttp.Request) {
	setAuditTargetUser(r, userID(r))
	list, err := service.DB().Model("users").Where("id", userID(r)).Where("disabled", 0).One()
	if err != nil || list.IsEmpty() {
		writeError(r, http.StatusBadRequest, "用户不存在或已禁用")
		return
	}
	code := service.NormalizeUserCode(list["code"].String())
	if !service.IsValidUserCode(code) {
		writeError(r, http.StatusInternalServerError, "用户 code 不可用")
		return
	}
	templates, _ := service.DB().Model("templates").Where("enabled", 1).Order("module ASC").All()
	links := make([]map[string]any, 0, len(templates))
	for _, item := range templates {
		module := item["module"].String()
		query := url.Values{}
		query.Set("m", publicModuleCode(module))
		query.Set("t", code)
		links = append(links, map[string]any{"module": module, "token": code, "path": "/h5?" + query.Encode()})
	}
	writeJSON(r, links)
}

// 2026-09-12 00:00:00 CST：后台生成的访客链接统一指向单一 `/h5` 页面，并将内部 module1 转为外部 m1。
// 触发场景：Admin 调用 `/api/visitor-links` 生成访客入口；维护时必须保证 m1~m10 与前端 H5Page 的映射一致。
// 维护注意：token 使用 url.Values 编码，禁止恢复为路径片段，避免特殊字符破坏链接结构。
func publicModuleCode(module string) string {
	return "m" + strings.TrimPrefix(module, "module")
}

func submitVisitor(r *ghttp.Request) {
	var req model.VisitorSubmit
	if err := r.Parse(&req); err != nil || req.Module == "" || req.Token == "" || strings.TrimSpace(req.Items["item1"]) == "" {
		writeError(r, http.StatusBadRequest, "module、token 和 item1 不能为空")
		return
	}
	visitorKey := service.NormalizeVisitorKey(req.Key)
	if visitorKey == "" {
		visitorKey = "key1"
	}
	if visitorKey == service.VisitorWaitingKey {
		writeError(r, http.StatusBadRequest, "访客提交 key 无效")
		return
	}
	code := service.NormalizeUserCode(req.Token)
	if !service.IsValidUserCode(code) {
		writeError(r, http.StatusUnauthorized, "访客 code 无效")
		return
	}
	owner, err := service.DB().Model("users").Where("code", code).Where("disabled", 0).One()
	if err != nil || owner.IsEmpty() {
		writeError(r, http.StatusUnauthorized, "访客 code 无效或所属用户不存在")
		return
	}
	if isBlocked(r, owner["id"].Int64()) {
		writeError(r, http.StatusForbidden, "当前 IP 已被禁止访问")
		return
	}
	requestID := strings.TrimSpace(req.RequestID)
	if requestID == "" {
		requestID = fmt.Sprintf("%d-%s", time.Now().UnixNano(), req.Items["item1"])
	}
	once, redisErr := service.SetRequestOnce(requestContext(r), "cheat-gf:submit:"+requestID, 10*time.Minute)
	if redisErr == nil && !once {
		writeJSON(r, map[string]string{"message": "重复提交已忽略"})
		return
	}
	// 2026-09-30 10:28:56 CST：提交访客资料时同步当前 H5 连接状态，处理 WebSocket 先于首条访客记录建立的情况。
	// 触发场景：页面首次提交前已完成 WebSocket 握手；维护时题号仍写入 visitor_key，连接状态只写独立列。
	defer service.LockAppConnectionState(req.Module, owner["id"].Int64(), req.Items["item1"])()
	connectionStatus := "offline"
	if service.AppConnectionCount(req.Module, owner["id"].Int64(), req.Items["item1"]) > 0 {
		connectionStatus = "online"
	}
	data := gdb.Map{"module": req.Module, "visitor_key": service.VisitorWaitingKey, "connection_status": connectionStatus, "user_id": owner["id"].Int64(), "ip": r.GetClientIp(), "item1": req.Items["item1"], "visit_count": 1}
	for i := 2; i <= 20; i++ {
		key := fmt.Sprintf("item%d", i)
		if value, ok := req.Items[key]; ok {
			data[key] = value
		}
	}
	visitor, findErr := service.DB().Model("visitors").Where("module", req.Module).Where("user_id", owner["id"].Int64()).Where("item1", req.Items["item1"]).One()
	var visitorID int64
	if findErr == nil && !visitor.IsEmpty() {
		visitorID = visitor["id"].Int64()
		delete(data, "visit_count")
		if _, err = service.DB().Model("visitors").Where("id", visitorID).Data(data).Update(); err != nil {
			writeError(r, http.StatusInternalServerError, "更新访客失败")
			return
		}
		_, _ = service.DB().Model("visitors").Where("id", visitorID).Increment("visit_count", 1)
	} else {
		result, insertErr := service.DB().Model("visitors").Data(data).InsertAndGetId()
		if insertErr != nil {
			writeError(r, http.StatusInternalServerError, "保存访客失败")
			return
		}
		visitorID = result
	}
	_, _ = service.DB().Model("visit_events").Data(gdb.Map{"module": req.Module, "user_id": owner["id"].Int64(), "visitor_id": visitorID, "ip": r.GetClientIp(), "request_id": requestID}).Insert()
	// 2026-09-21 15:20:00 CST：实时事件保留本次提交的 key，同时继续用 waiting 表示访客已提交、等待 Admin 下一步操作。
	// 触发场景：同一 module 的不同 key 页面独立提交；Admin 需要知道本次更新来自哪个页面并刷新答案列。
	// 维护注意：visitor_key 仍保存 waiting 状态，submittedKey 仅用于实时事件，不改变管理员下一步导航规则。
	service.PublishVisitor(owner["id"].Int64(), map[string]any{"type": "visitor.updated", "module": req.Module, "key": service.VisitorWaitingKey, "submittedKey": visitorKey, "visitorId": visitorID, "userId": owner["id"].Int64(), "item1": req.Items["item1"]})
	writeJSON(r, map[string]any{"visitorId": visitorID, "message": "提交成功"})
}

func listVisitors(r *ghttp.Request) {
	page, pageSize := queryPage(r)
	// 2026-09-13 13:40:00 CST：MySQL 将 key 视为保留字，使用转义别名保持 API 仍返回 key 字段。
	// 触发场景：Admin 访客管理读取列表；维护时若调整别名，必须同步 VisitorRow 与 H5/Admin 数据契约。
	m := service.DB().Model("visitors v").LeftJoin("users u", "u.id=v.user_id").Fields("v.*,v.visitor_key AS `key`,u.username,u.code").Page(page, pageSize).Order("v.updated_at DESC")
	if role(r) != "admin" {
		m = m.Where("v.user_id", userID(r))
	} else if value := r.GetQuery("userId").String(); value != "" {
		m = m.Where("v.user_id", value)
	}
	if module := r.GetQuery("module").String(); module != "" {
		m = m.Where("v.module", module)
	}
	list, total, err := m.AllAndCount(false)
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取访客失败")
		return
	}
	rows := list.List()
	for i := range rows {
		// 2026-09-10 15:12:00 CST：为已授权的访客记录补充用户 code，供 Admin 定向控制 App 连接。
		// 触发场景：管理员或归属用户从访客表点击 module；维护时必须保持查询权限先于 code 暴露，避免越权。
		rows[i]["token"] = service.NormalizeUserCode(fmt.Sprint(rows[i]["code"]))
	}
	writeJSON(r, map[string]any{"list": rows, "total": total})
}

func deleteVisitor(r *ghttp.Request) {
	id, ok := parseID(r, "id")
	if !ok {
		writeError(r, http.StatusBadRequest, "访客编号无效")
		return
	}
	m := service.DB().Model("visitors").Where("id", id)
	if role(r) != "admin" {
		m = m.Where("user_id", userID(r))
	}
	if _, err := m.Delete(); err != nil {
		writeError(r, http.StatusInternalServerError, "删除访客失败")
		return
	}
	writeJSON(r, map[string]string{"message": "删除成功"})
}

func batchVisitors(r *ghttp.Request) {
	var req model.BatchIDsRequest
	if err := r.Parse(&req); err != nil || req.Action != "delete" {
		writeError(r, http.StatusBadRequest, "访客批量操作无效")
		return
	}
	if err := validateBatchIDs(req.IDs); err != nil {
		writeError(r, http.StatusBadRequest, err.Error())
		return
	}
	setAuditTargetIDs(r, req.IDs)
	// 2026-09-13 10:05:31 CST：访客批量删除先按登录角色校验完整 ID 集合，再在事务中执行，防止普通用户删除他人记录。
	err := service.DB().Transaction(requestContext(r), func(ctx context.Context, tx gdb.TX) error {
		m := tx.Model("visitors").WhereIn("id", req.IDs)
		if role(r) != "admin" {
			m = m.Where("user_id", userID(r))
		}
		count, err := m.Count()
		if err != nil {
			return fmt.Errorf("读取访客失败: %w", err)
		}
		if count != len(req.IDs) {
			return fmt.Errorf("部分访客记录不存在或无权限，未执行任何操作")
		}
		_, err = m.Delete()
		return err
	})
	if err != nil {
		writeError(r, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(r, map[string]string{"message": "批量删除成功"})
}

func exportVisitors(r *ghttp.Request) {
	m := service.DB().Model("visitors v").LeftJoin("users u", "u.id=v.user_id").Fields("v.*,u.username").Order("v.updated_at DESC")
	if role(r) != "admin" {
		m = m.Where("v.user_id", userID(r))
	} else if value := r.GetQuery("userId").String(); value != "" {
		m = m.Where("v.user_id", value)
	}
	list, err := m.All()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "导出访客失败")
		return
	}
	dictionary, dictionaryErr := service.ListDataDictionary(requestContext(r))
	itemKeys := exportVisitorItemKeys(r.GetQuery("fields").String())
	if len(itemKeys) > 0 && dictionaryErr != nil {
		writeError(r, http.StatusInternalServerError, "读取数据字典失败，无法导出访客字段名称")
		return
	}
	names := make(map[string]string)
	if dictionaryErr == nil {
		for _, item := range dictionary {
			names[item.Key] = item.Label
		}
	}
	// 2026-09-10 20:46:28 CST：导出 TXT 使用 Redis 数据字典的字段名称，保证文件内容与访客表格展示一致。
	// 触发场景：管理员修改 item 字段名称后导出访客数据；维护时应继续通过数据字典读取名称，不要恢复为 field_mappings。
	var builder strings.Builder
	for _, item := range list {
		builder.WriteString(fmt.Sprintf("模板: %s\n用户: %s\nIP: %s\n", item["module"].String(), item["username"].String(), item["ip"].String()))
		for _, key := range itemKeys {
			builder.WriteString(fmt.Sprintf("%s: %s\n", displayName(key, names), item[key].String()))
		}
		builder.WriteString("--------------------\n")
	}
	r.Response.Header().Set("Content-Type", "text/plain; charset=utf-8")
	r.Response.Header().Set("Content-Disposition", "attachment; filename=visitors.txt")
	r.Response.Write(builder.String())
}

func exportVisitorItemKeys(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return allVisitorItemKeys()
	}
	if strings.TrimSpace(raw) == "__none__" {
		return []string{}
	}
	keys := make([]string, 0, 20)
	seen := make(map[string]struct{}, 20)
	for _, value := range strings.Split(raw, ",") {
		key := strings.TrimSpace(value)
		if !service.IsVisitorItemKey(key) {
			continue
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		keys = append(keys, key)
	}
	return keys
}

func allVisitorItemKeys() []string {
	keys := make([]string, 0, 20)
	for i := 1; i <= 20; i++ {
		keys = append(keys, fmt.Sprintf("item%d", i))
	}
	return keys
}

func displayName(key string, names map[string]string) string {
	if value, ok := names[key]; ok && value != "" {
		return value
	}
	return key
}
