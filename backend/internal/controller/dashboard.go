package controller

import (
	"net/http"
	"strings"
	"time"

	"github.com/gogf/gf/v2/net/ghttp"

	"backend/internal/service"
)

func dashboard(r *ghttp.Request) {
	page, pageSize := queryPage(r)
	visitors, err := service.DB().Model("visitors").Where("user_id", userID(r)).Count()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取仪表盘失败")
		return
	}
	if role(r) == "admin" {
		visitors, _ = service.DB().Model("visitors").Count()
	}
	online := service.ActiveConnectionCount()
	ipCount, _ := service.DB().Model("visit_events").Where("user_id", userID(r)).Fields("DISTINCT ip").Count()
	visits, _ := service.DB().Model("visit_events").Where("user_id", userID(r)).Count()
	if role(r) == "admin" {
		ipCount, _ = service.DB().Model("visit_events").Fields("DISTINCT ip").Count()
		visits, _ = service.DB().Model("visit_events").Count()
	}
	moduleQuery := service.DB().Model("visit_events").Fields("module, COUNT(*) AS visits")
	if role(r) != "admin" {
		moduleQuery = moduleQuery.Where("user_id", userID(r))
	}
	modules, moduleTotal, err := moduleQuery.Group("module").Order("module ASC").Page(page, pageSize).AllAndCount(false)
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取仪表盘模板访问量失败")
		return
	}
	moduleLabelRows, err := service.DB().Model("templates").Fields("module,label").All()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取 module 显示名称失败")
		return
	}
	moduleLabels := make(map[string]string, moduleLabelRows.Len())
	for _, row := range moduleLabelRows {
		module := row["module"].String()
		label := strings.TrimSpace(row["label"].String())
		if label == "" {
			label = module
		}
		moduleLabels[module] = label
	}

	// 2026-09-13 11:29:26 CST：仪表盘折线图按服务端本地日期聚合近 7 天访问量，管理员查询全量，普通用户严格限定当前用户。
	// 触发场景：前端展示 10 个 module 的每日趋势；维护时必须保留无数据日期由前端补零，避免折线断点含义不一致。
	today := time.Now()
	trendStart := time.Date(today.Year(), today.Month(), today.Day()-6, 0, 0, 0, 0, today.Location())
	trendQuery := service.DB().Model("visit_events").Fields("DATE_FORMAT(created_at, '%Y-%m-%d') AS day, module, COUNT(*) AS visits").Where("created_at >= ?", trendStart)
	if role(r) != "admin" {
		trendQuery = trendQuery.Where("user_id", userID(r))
	}
	trendRows, err := trendQuery.Group("DATE_FORMAT(created_at, '%Y-%m-%d'), module").Order("day ASC, module ASC").All()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取仪表盘访问趋势失败")
		return
	}
	trendDays := make([]string, 7)
	for index := range trendDays {
		trendDays[index] = trendStart.AddDate(0, 0, index).Format("2006-01-02")
	}

	// 2026-09-13 11:29:26 CST：最近动作直接复用审计日志表，仅返回最新 10 条；普通用户只能看到自己的操作记录。
	// 触发场景：仪表盘右侧需要固定高度的近期活动列表；维护时不要移除 operator_id 限制，否则会造成普通用户越权查看日志。
	recentQuery := service.DB().Model("audit_logs l").LeftJoin("users u", "u.id=l.operator_id").Fields("l.id,l.operator_id,COALESCE(u.username,l.operator_username) AS operator_name,l.target_user_id,l.action,l.target_type,l.target_ids,l.target_ref,l.request_ip,l.success,l.error_message,l.created_at").Order("l.id DESC").Limit(10)
	if role(r) != "admin" {
		recentQuery = recentQuery.Where("l.operator_id", userID(r))
	}
	recentActions, err := recentQuery.All()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取最近操作失败")
		return
	}

	// 2026-09-10 20:16:48 CST：仪表盘模板访问量使用独立分页查询，统计卡片仍返回全量汇总值。
	// 触发场景：模板数量增加或访问事件较多时，避免仪表盘接口一次返回全部分组结果。
	writeJSON(r, map[string]any{
		"visitorCount": visitors, "onlineUsers": online, "ipCount": ipCount, "visitTotal": visits,
		"moduleVisits":     map[string]any{"list": modules.List(), "total": moduleTotal},
		"moduleLabels":     moduleLabels,
		"moduleVisitTrend": map[string]any{"days": trendDays, "list": trendRows.List()},
		"recentActions":    recentActions.List(),
	})
}
