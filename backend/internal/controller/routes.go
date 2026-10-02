package controller

import "github.com/gogf/gf/v2/net/ghttp"

func RegisterRoutes(group *ghttp.RouterGroup) {
	group.Middleware(func(r *ghttp.Request) {
		r.Response.CORSDefault()
		r.Middleware.Next()
	})

	group.GET("/health", func(r *ghttp.Request) { writeJSON(r, map[string]string{"status": "ok"}) })
	group.POST("/api/auth/login", withAudit("auth.login", "auth", login))
	group.POST("/api/auth/password", withAuth(withAudit("auth.password.change", "user", changePassword), false))
	group.GET("/api/auth/refresh", withAuth(refresh, false))
	group.GET("/api/auth/user", withAuth(authUser, false))
	group.GET("/api/auth/permissions", withAuth(authPermissions, false))
	group.POST("/api/auth/logout", withAuth(withAudit("auth.logout", "user", func(r *ghttp.Request) { writeJSON(r, map[string]string{"message": "已退出"}) }), false))
	group.GET("/api/audit-logs/operators", withAuth(listAuditOperators, true))
	group.GET("/api/audit-logs", withAuth(listAuditLogs, true))
	group.GET("/api/ip-region", withAuth(lookupIPRegion, false))

	// 2026-09-10 11:32:18 CST：用户筛选选项只服务于管理员跨用户查询，普通用户不应通过该接口获取全量用户信息。
	group.GET("/api/users/options", withAuth(listUserOptions, true))
	group.GET("/api/users", withAuth(listUsers, true))
	group.POST("/api/users", withAuth(withAudit("users.create", "user", createUser), true))
	group.PUT("/api/users/:id", withAuth(withAudit("users.update", "user", updateUser), true))
	group.DELETE("/api/users/:id", withAuth(withAudit("users.delete", "user", deleteUser), true))
	group.POST("/api/users/batch", withAuth(withAudit("users.batch", "user", batchUsers), true))

	group.GET("/api/blacklist", withAuth(listBlacklist, false))
	group.POST("/api/blacklist", withAuth(withAudit("blacklist.create", "blacklist", createBlacklist), false))
	group.DELETE("/api/blacklist/:id", withAuth(withAudit("blacklist.delete", "blacklist", deleteBlacklist), false))
	group.POST("/api/blacklist/batch", withAuth(withAudit("blacklist.batch", "blacklist", batchBlacklist), false))

	group.GET("/api/mappings", withAuth(listMappings, false))
	group.POST("/api/mappings", withAuth(withAudit("mappings.create", "mapping", saveMapping), true))
	group.PUT("/api/mappings/:id", withAuth(withAudit("mappings.update", "mapping", updateMapping), true))
	group.DELETE("/api/mappings/:id", withAuth(withAudit("mappings.delete", "mapping", deleteMapping), true))
	group.POST("/api/mappings/batch", withAuth(withAudit("mappings.batch", "mapping", batchMappings), true))
	group.GET("/api/dictionary", withAuth(listDataDictionary, false))
	group.POST("/api/dictionary", withAuth(withAudit("dictionary.create", "dictionary", createDataDictionary), true))
	group.PUT("/api/dictionary/:key", withAuth(withAudit("dictionary.update", "dictionary", updateDataDictionary), true))
	group.DELETE("/api/dictionary/:key", withAuth(withAudit("dictionary.delete", "dictionary", deleteDataDictionary), true))
	group.POST("/api/dictionary/batch", withAuth(withAudit("dictionary.batch", "dictionary", batchDataDictionary), true))

	group.GET("/api/templates", withAuth(listTemplates, false))
	group.PUT("/api/templates/:module", withAuth(withAudit("templates.update", "template", updateTemplate), true))
	group.POST("/api/templates/batch", withAuth(withAudit("templates.batch", "template", batchTemplates), true))
	group.GET("/api/dashboard", withAuth(dashboard, false))
	group.GET("/api/visitor-links", withAuth(withAudit("visitor_links.create", "visitor_link", createVisitorLink), false))
	group.GET("/api/visitors", withAuth(listVisitors, false))
	group.DELETE("/api/visitors/:id", withAuth(withAudit("visitors.delete", "visitor", deleteVisitor), false))
	group.POST("/api/visitors/batch", withAuth(withAudit("visitors.batch", "visitor", batchVisitors), false))
	group.GET("/api/visitors/export", withAuth(withAudit("visitors.export", "visitor", exportVisitors), false))

	// App 端公开接口：token 参数承载用户 code，具体提交仍会校验模块和黑名单。
	group.GET("/api/public/templates/:module", publicTemplate)
	group.GET("/api/public/module-data/:module", publicModuleData)
	group.POST("/api/public/visitors/submit", submitVisitor)
	group.GET("/ws", websocketHandler)
	group.GET("/api/ws", func(r *ghttp.Request) {
		adminWebsocket(r)
	})
}
