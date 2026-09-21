package controller

import (
	"encoding/json"
	"net/http"
	"slices"
	"strings"

	"github.com/gogf/gf/v2/net/ghttp"

	"backend/internal/consts"
	"backend/internal/service"
)

func websocketHandler(r *ghttp.Request) {
	// 2026-09-10 15:12:00 CST：App 访客 WS 固定要求 r=0，并只允许 6 位用户 code。
	// 触发场景：区分 App 访客 WS 和 Admin JWT WS，防止错误 token 类型进入错误订阅通道。
	// 维护注意：r=0 不是授权凭证，用户归属必须继续由数据库唯一 code 查询确认。
	if r.GetQuery("r").String() != "0" {
		writeError(r, http.StatusForbidden, "访客 WebSocket 角色无效")
		return
	}
	code := service.NormalizeUserCode(r.GetQuery("token").String())
	module := r.GetQuery("module").String()
	item1 := strings.TrimSpace(r.GetQuery("item1").String())
	if !service.IsValidUserCode(code) || item1 == "" {
		writeError(r, http.StatusBadRequest, "访客 WebSocket 需要 item1")
		return
	}
	owner, err := service.DB().Model("users").Where("code", code).Where("disabled", 0).One()
	if err != nil || owner.IsEmpty() || isBlocked(r, owner["id"].Int64()) {
		writeError(r, http.StatusUnauthorized, "WebSocket code 无效")
		return
	}
	ws, err := r.WebSocket()
	if err != nil {
		return
	}
	service.ConnectionOpened()
	defer service.ConnectionClosed()
	defer ws.Close()
	write := func(data []byte) { _ = ws.WriteMessage(ghttp.WsMsgText, data) }
	// 2026-09-10 14:35:00 CST：App 握手时把归属用户和 item1 绑定到连接，后续只接收目标访客的导航指令。
	// 触发场景：App 已完成 item1 填写后建立 WS；未填写 item1 的页面不得占用访客订阅。
	// 维护注意：绑定条件来自已验证的用户 code 和请求中的 item1，Admin 指令必须同时匹配两者。
	remove := service.SubscribeApp(owner["id"].Int64(), item1, write)
	defer remove()
	intro, _ := json.Marshal(map[string]any{"type": "connected", "module": module, "userId": owner["id"].Int64()})
	write(intro)
	_ = readWebSocketMessages(ws, nil)
}

func adminWebsocket(r *ghttp.Request) {
	// 2026-09-10 13:16:05 CST：Admin WS 通过 r 区分普通用户和管理员，再校验 JWT 角色是否匹配。
	// 触发场景：普通用户只订阅自身访客更新，管理员才允许订阅全局更新。
	// 维护注意：不能只信任 r；JWT 签名、有效期、IP 和 role 必须全部验证通过。
	connectionRole := r.GetQuery("r").String()
	if connectionRole != "1" && connectionRole != "2" {
		writeError(r, http.StatusForbidden, "管理端 WebSocket 角色无效")
		return
	}
	token := bearerToken(r)
	if token == "" {
		token = r.GetQuery("token").String()
	}
	claims, err := service.ParseJWT(token, r.GetClientIp())
	if err != nil {
		writeError(r, http.StatusUnauthorized, "登录已失效")
		return
	}
	subscriptionUserID := int64(0)
	if connectionRole == "1" {
		if claims.Role != consts.RoleUser {
			writeError(r, http.StatusForbidden, "普通用户 WebSocket 角色不匹配")
			return
		}
		subscriptionUserID = claims.UserID
	} else if claims.Role != consts.RoleAdmin {
		writeError(r, http.StatusForbidden, "管理员 WebSocket 角色不匹配")
		return
	}
	ws, err := r.WebSocket()
	if err != nil {
		return
	}
	service.ConnectionOpened()
	defer service.ConnectionClosed()
	defer ws.Close()
	remove := service.Subscribe(subscriptionUserID, func(data []byte) { _ = ws.WriteMessage(ghttp.WsMsgText, data) })
	defer remove()
	// 普通用户仍可在自己的访客范围内发起操作，管理员则可按 Admin 页面选择的用户定向控制连接。
	commandHandler := func(data []byte) error {
		return handleAdminCommand(ws, data, claims.Role, claims.UserID)
	}
	_ = readWebSocketMessages(ws, commandHandler)
}

type webSocketMessageReader interface {
	ReadMessage() (messageType int, data []byte, err error)
	WriteMessage(messageType int, data []byte) error
}

// 2026-09-10 14:04:13 CST：App 和 Admin 共用应用层心跳处理，收到 ping 后立即返回 pong。
// 触发场景：浏览器原生 WebSocket 无法由前端主动发送协议层 ping，需要业务消息维持连接活性。
// 维护注意：业务推送仍按原订阅范围发送，心跳消息不得触发 Admin 的访客列表刷新。
func readWebSocketMessages(ws webSocketMessageReader, handle func([]byte) error) error {
	for {
		messageType, data, err := ws.ReadMessage()
		if err != nil {
			return err
		}
		if messageType != ghttp.WsMsgText {
			continue
		}
		var message struct {
			Type string `json:"type"`
		}
		if json.Unmarshal(data, &message) == nil && message.Type == "ping" {
			if err = ws.WriteMessage(ghttp.WsMsgText, []byte(`{"type":"pong"}`)); err != nil {
				return err
			}
			continue
		}
		if handle != nil {
			if err = handle(data); err != nil {
				return err
			}
		}
	}
}

type adminNavigateCommand struct {
	Type   string `json:"type"`
	UserID int64  `json:"userId"`
	Item1  string `json:"item1"`
	Module string `json:"module"`
	Key    string `json:"key"`
}

// 2026-09-13 12:05:00 CST：Admin WS 接收定向 key 切换命令并返回投递结果，module 只作为固定题型上下文传递。
// 触发场景：管理员点击访客表格的 key 操作按钮；waiting 不允许由 Admin 主动设置。
// 维护注意：必须校验 userId、item1、启用模板、已开启 key 和权限，并在 H5 无连接时回滚访客状态。
func handleAdminCommand(ws webSocketMessageReader, data []byte, role string, currentUserID int64) error {
	var command adminNavigateCommand
	if err := json.Unmarshal(data, &command); err != nil || command.Type != "visitor.navigate" {
		return nil
	}
	command.Item1 = strings.TrimSpace(command.Item1)
	command.Key = strings.ToLower(strings.TrimSpace(command.Key))
	if command.UserID <= 0 || command.Item1 == "" || command.Module == "" || !service.IsTemplateKey(command.Key) {
		return writeAdminCommandResult(ws, command, false, "invalid_command")
	}
	if role == consts.RoleUser && command.UserID != currentUserID {
		return writeAdminCommandResult(ws, command, false, "user_scope_denied")
	}
	template, err := service.DB().Model("templates").Where("module", command.Module).Where("enabled", 1).One()
	if err != nil || template.IsEmpty() {
		return writeAdminCommandResult(ws, command, false, "module_disabled")
	}
	if !slices.Contains(service.ParseTemplateKeys(template["template_keys"].String()), command.Key) {
		return writeAdminCommandResult(ws, command, false, "key_disabled")
	}
	visitor, err := service.DB().Model("visitors").Where("module", command.Module).Where("user_id", command.UserID).Where("item1", command.Item1).One()
	if err != nil || visitor.IsEmpty() {
		return writeAdminCommandResult(ws, command, false, "visitor_not_found")
	}
	previousKey := service.NormalizeVisitorKey(visitor["visitor_key"].String())
	if previousKey == "" {
		previousKey = "key1"
	}
	if _, err = service.DB().Model("visitors").Where("id", visitor["id"].Int64()).Data(map[string]any{"visitor_key": command.Key}).Update(); err != nil {
		return writeAdminCommandResult(ws, command, false, "state_update_failed")
	}
	connected := service.PublishAppCommand(command.UserID, command.Item1, map[string]any{
		"type":   "visitor.navigate",
		"module": command.Module,
		"key":    command.Key,
	})
	if !connected {
		_, _ = service.DB().Model("visitors").Where("id", visitor["id"].Int64()).Data(map[string]any{"visitor_key": previousKey}).Update()
		return writeAdminCommandResult(ws, command, false, "no_connection")
	}
	service.PublishVisitor(command.UserID, map[string]any{"type": "visitor.updated", "module": command.Module, "key": command.Key, "visitorId": visitor["id"].Int64(), "userId": command.UserID, "item1": command.Item1})
	return writeAdminCommandResult(ws, command, true, "")
}

func writeAdminCommandResult(ws webSocketMessageReader, command adminNavigateCommand, ok bool, reason string) error {
	result := map[string]any{
		"type":   "visitor.command.result",
		"ok":     ok,
		"module": command.Module,
		"key":    command.Key,
		"userId": command.UserID,
	}
	if reason != "" {
		result["reason"] = reason
	}
	data, _ := json.Marshal(result)
	return ws.WriteMessage(ghttp.WsMsgText, data)
}
