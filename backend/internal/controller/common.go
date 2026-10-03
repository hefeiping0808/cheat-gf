package controller

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gogf/gf/v2/net/ghttp"
	"github.com/gogf/gf/v2/util/gconv"

	"backend/internal/consts"
	"backend/internal/service"
)

func withAuth(next func(*ghttp.Request), adminOnly bool) func(*ghttp.Request) {
	return func(r *ghttp.Request) {
		claims, err := service.ParseJWT(bearerToken(r), r.GetClientIp())
		if err != nil || (adminOnly && claims.Role != consts.RoleAdmin) {
			writeError(r, http.StatusUnauthorized, "登录已失效或无权限")
			return
		}
		r.SetCtxVar(consts.CtxUserID, claims.UserID)
		r.SetCtxVar(consts.CtxRole, claims.Role)
		next(r)
	}
}

func bearerToken(r *ghttp.Request) string {
	value := strings.TrimSpace(r.GetHeader("Authorization"))
	return strings.TrimSpace(strings.TrimPrefix(value, "Bearer "))
}

func userID(r *ghttp.Request) int64 { return r.GetCtxVar(consts.CtxUserID).Int64() }
func role(r *ghttp.Request) string  { return r.GetCtxVar(consts.CtxRole).String() }

func writeJSON(r *ghttp.Request, data any) {
	r.Response.WriteJson(map[string]any{"code": 0, "data": data, "message": "ok"})
}

func writeError(r *ghttp.Request, status int, message string) {
	markAuditFailure(r, message)
	// 2026-10-02 17:07:11 CST：错误响应只设置 HTTP 状态码，再写统一 JSON 信封，避免 WriteStatus 默认输出状态文本污染 JSON。
	// 触发场景：登录密码错误等非 2xx 响应；维护时需保持 {code,data,message}，供 Admin 客户端稳定解析 message。
	r.Response.WriteHeader(status)
	r.Response.WriteJson(map[string]any{"code": status, "data": nil, "message": message})
}

// writeErrorCode 给前端返回稳定的英文错误码，具体文案由管理端当前语言词典负责展示。
// 更新时间：2026-09-10 11:13:36 CST。
func writeErrorCode(r *ghttp.Request, status int, code string) {
	markAuditFailure(r, code)
	r.Response.WriteStatus(status)
	r.Response.WriteJson(map[string]any{"code": code, "data": nil, "message": code})
}

func parseID(r *ghttp.Request, key string) (int64, bool) {
	id, err := strconv.ParseInt(r.GetRouter(key).String(), 10, 64)
	return id, err == nil && id > 0
}

func requestContext(r *ghttp.Request) context.Context { return r.Context() }

func queryPage(r *ghttp.Request) (int, int) {
	page := gconv.Int(r.GetQuery("page"))
	pageSize := gconv.Int(r.GetQuery("pageSize"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		// 2026-09-10 20:16:48 CST：统一将缺省或越界 pageSize 收敛到 10，最大只允许 100，避免接口被大页请求拖慢。
		pageSize = 10
	}
	return page, pageSize
}

// validateBatchIDs 统一限制批量请求规模、去重并校验 ID，防止空请求、重复请求和异常大请求进入事务。
// 更新时间：2026-09-13 10:05:31 CST。
func validateBatchIDs(ids []int64) error {
	if len(ids) == 0 {
		return fmt.Errorf("至少选择一条记录")
	}
	if len(ids) > 100 {
		return fmt.Errorf("一次最多操作 100 条记录")
	}
	seen := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return fmt.Errorf("记录编号无效")
		}
		if _, exists := seen[id]; exists {
			return fmt.Errorf("记录编号不能重复")
		}
		seen[id] = struct{}{}
	}
	return nil
}
