package controller

import (
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"time"

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
	// 2026-09-30 10:28:56 CST：连接状态按访客唯一键更新，断开时只在最后一个对应 H5 连接关闭后标记离线。
	// 触发场景：访客列表需要即时显示 H5 状态；连接状态锁避免并发重连与旧连接清理交错写反状态。
	// 维护注意：visitor_key 保持题号语义；在线状态单独写 connection_status，心跳读取超时负责回收失联连接。
	unlockState := service.LockAppConnectionState(module, owner["id"].Int64(), item1)
	remove := service.SubscribeApp(module, owner["id"].Int64(), item1, write)
	setVisitorConnectionStatus(module, owner["id"].Int64(), item1, "online")
	unlockState()
	defer func() {
		unlockState := service.LockAppConnectionState(module, owner["id"].Int64(), item1)
		remove()
		if service.AppConnectionCount(module, owner["id"].Int64(), item1) == 0 {
			setVisitorConnectionStatus(module, owner["id"].Int64(), item1, "offline")
		}
		unlockState()
	}()
	intro, _ := json.Marshal(map[string]any{"type": "connected", "module": module, "userId": owner["id"].Int64()})
	write(intro)
	lastHeartbeatKey := ""
	_ = readWebSocketMessages(ws, func(data []byte) error {
		return syncVisitorKeyFromHeartbeat(module, owner["id"].Int64(), item1, data, &lastHeartbeatKey)
	})
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

type webSocketReadDeadliner interface {
	SetReadDeadline(time.Time) error
}

// setVisitorConnectionStatus 仅在真实状态变化时写库并通知访客管理页，避免每次重连都制造无意义更新。
// 更新时间：2026-09-30 10:28:56 CST。
func setVisitorConnectionStatus(module string, userID int64, item1 string, status string) {
	visitor, err := service.DB().Model("visitors").Where("module", module).Where("user_id", userID).Where("item1", item1).One()
	if err != nil || visitor.IsEmpty() || visitor["connection_status"].String() == status {
		return
	}
	if _, err = service.DB().Model("visitors").Where("id", visitor["id"].Int64()).Data(map[string]any{"connection_status": status}).Update(); err != nil {
		return
	}
	service.PublishVisitor(userID, map[string]any{
		"type": "visitor.connection.updated", "module": module, "visitorId": visitor["id"].Int64(),
		"userId": userID, "item1": item1, "connectionStatus": status,
	})
}

// syncVisitorKeyFromHeartbeat 将 H5 当前题号同步到已绑定的访客记录，忽略无效 key 和尚未创建的访客记录。
// 更新时间：2026-10-02 01:00:38 CST。
func syncVisitorKeyFromHeartbeat(module string, userID int64, item1 string, data []byte, lastHeartbeatKey *string) error {
	var heartbeat struct {
		Type string `json:"type"`
		Key  string `json:"key"`
	}
	if err := json.Unmarshal(data, &heartbeat); err != nil || heartbeat.Type != "ping" {
		return nil
	}
	key := service.NormalizeVisitorKey(heartbeat.Key)
	if key == "" || key == *lastHeartbeatKey {
		return nil
	}
	visitor, err := service.DB().Model("visitors").Where("module", module).Where("user_id", userID).Where("item1", item1).One()
	if err != nil || visitor.IsEmpty() || service.NormalizeVisitorKey(visitor["visitor_key"].String()) == key {
		if err == nil && !visitor.IsEmpty() {
			*lastHeartbeatKey = key
		}
		return nil
	}
	if _, err = service.DB().Model("visitors").Where("id", visitor["id"].Int64()).Data(map[string]any{"visitor_key": key}).Update(); err != nil {
		return nil
	}
	service.PublishVisitor(userID, map[string]any{
		"type": "visitor.key.updated", "module": module, "key": key,
		"visitorId": visitor["id"].Int64(), "userId": userID, "item1": item1,
	})
	*lastHeartbeatKey = key
	return nil
}

// 2026-09-10 14:04:13 CST：App 和 Admin 共用应用层心跳处理，收到 ping 后立即返回 pong。
// 触发场景：浏览器原生 WebSocket 无法由前端主动发送协议层 ping，需要业务消息维持连接活性。
// 维护注意：业务推送仍按原订阅范围发送，心跳消息不得触发 Admin 的访客列表刷新。
func readWebSocketMessages(ws webSocketMessageReader, handle func([]byte) error) error {
	for {
		// 2026-09-30 10:28:56 CST：服务端 60 秒未收到 H5/Admin 心跳即结束读取，避免网络半断开长期保留在线状态。
		// 触发场景：浏览器被关闭、网络切换或客户端进程退出时，TCP 连接可能不会及时送达断开事件。
		// 维护注意：前端当前每 20 秒发一次 ping；调整客户端心跳间隔时要同步评估该超时窗口。
		if deadliner, ok := ws.(webSocketReadDeadliner); ok {
			if err := deadliner.SetReadDeadline(time.Now().Add(60 * time.Second)); err != nil {
				return err
			}
		}
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
			if handle != nil {
				if err = handle(data); err != nil {
					return err
				}
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
	connected := service.PublishAppCommand(command.Module, command.UserID, command.Item1, map[string]any{
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
