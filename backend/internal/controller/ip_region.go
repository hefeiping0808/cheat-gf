package controller

import (
	"net/http"
	"strings"

	"github.com/gogf/gf/v2/net/ghttp"

	"backend/internal/service"
)

// lookupIPRegion 为管理端提供只读归属地查询；原始 IP 仍保留在访客、黑名单和审计数据中。
// 触发场景：前端 IP 展示组件请求国家-地区；无效地址返回 400，内网/回源等特殊地址由 service 跳过外部查询。
// 更新时间：2026-09-30 02:13:10 CST。
func lookupIPRegion(r *ghttp.Request) {
	ip := strings.TrimSpace(r.GetQuery("ip").String())
	region, err := service.LookupIPRegion(requestContext(r), ip)
	if err != nil {
		writeError(r, http.StatusBadRequest, "IP 地址无效")
		return
	}
	writeJSON(r, map[string]string{"region": region})
}
