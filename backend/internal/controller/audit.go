package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gogf/gf/v2/net/ghttp"

	"backend/internal/service"
)

const auditContextKey = "audit.context"
const auditErrorKey = "audit.error"

type auditContext struct {
	TargetType   string
	TargetIDs    []int64
	TargetRef    string
	TargetUserID int64
}

// withAudit 是 Go handler 的装饰器替代方案：统一在业务 handler 前后采集审计元数据，不要求每个接口重复写日志落库代码。
// 更新时间：2026-09-13 10:20:00 CST。
func withAudit(action, targetType string, next func(*ghttp.Request)) func(*ghttp.Request) {
	return func(r *ghttp.Request) {
		meta := &auditContext{TargetType: targetType, TargetRef: auditTargetRef(r)}
		r.SetCtxVar(auditContextKey, meta)
		defer func() {
			status := r.Response.Status
			success := status >= http.StatusOK && status < http.StatusMultipleChoices
			errorMessage := r.GetCtxVar(auditErrorKey).String()
			if !success && errorMessage == "" {
				errorMessage = http.StatusText(status)
				if errorMessage == "" {
					errorMessage = "接口未返回响应"
				}
			}
			service.WriteAuditLog(r.Context(), service.AuditLogEntry{
				OperatorID:   userID(r),
				Action:       action,
				TargetType:   meta.TargetType,
				TargetIDs:    meta.TargetIDs,
				TargetRef:    meta.TargetRef,
				TargetUserID: meta.TargetUserID,
				RequestIP:    r.GetClientIp(),
				Success:      success,
				ErrorMessage: errorMessage,
			})
		}()
		next(r)
	}
}

func auditTargetRef(r *ghttp.Request) string {
	for _, key := range []string{"id", "module", "key"} {
		if value := strings.TrimSpace(r.GetRouter(key).String()); value != "" {
			return value
		}
	}
	return ""
}

func setAuditTargetIDs(r *ghttp.Request, ids []int64) {
	meta, ok := r.GetCtxVar(auditContextKey).Interface().(*auditContext)
	if !ok || meta == nil {
		return
	}
	meta.TargetIDs = append([]int64(nil), ids...)
}

func setAuditTargetUser(r *ghttp.Request, targetUserID int64) {
	meta, ok := r.GetCtxVar(auditContextKey).Interface().(*auditContext)
	if !ok || meta == nil {
		return
	}
	meta.TargetUserID = targetUserID
}

func setAuditTargetRef(r *ghttp.Request, targetRef string) {
	meta, ok := r.GetCtxVar(auditContextKey).Interface().(*auditContext)
	if !ok || meta == nil {
		return
	}
	meta.TargetRef = strings.TrimSpace(targetRef)
}

func markAuditFailure(r *ghttp.Request, message string) {
	r.SetCtxVar(auditErrorKey, message)
}

type auditLogQuery struct {
	OperatorID int64
	Action     string
	Success    string
	StartAt    string
	EndAt      string
}

func listAuditLogs(r *ghttp.Request) {
	query, err := parseAuditLogQuery(r)
	if err != nil {
		writeError(r, http.StatusBadRequest, err.Error())
		return
	}
	page, pageSize := queryPage(r)
	m := service.DB().Model("audit_logs l").LeftJoin("users u", "u.id=l.operator_id").Fields("l.id,l.operator_id,COALESCE(u.username,l.operator_username) AS operator_name,l.target_user_id,l.action,l.target_type,l.target_ids,l.target_ref,l.request_ip,l.success,l.error_message,l.created_at").Page(page, pageSize).Order("l.id DESC")
	if query.OperatorID > 0 {
		m = m.Where("l.operator_id", query.OperatorID)
	}
	if query.Action != "" {
		m = m.Where("l.action", query.Action)
	}
	if query.Success == "success" {
		m = m.Where("l.success", 1)
	} else if query.Success == "failed" {
		m = m.Where("l.success", 0)
	}
	if query.StartAt != "" {
		m = m.Where("l.created_at >= ?", query.StartAt)
	}
	if query.EndAt != "" {
		m = m.Where("l.created_at <= ?", query.EndAt)
	}
	list, total, err := m.AllAndCount(false)
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取操作日志失败")
		return
	}
	writeJSON(r, map[string]any{"list": list.List(), "total": total})
}

func parseAuditLogQuery(r *ghttp.Request) (auditLogQuery, error) {
	var query auditLogQuery
	operatorID := strings.TrimSpace(r.GetQuery("operatorId").String())
	if operatorID != "" {
		value, err := strconv.ParseInt(operatorID, 10, 64)
		if err != nil || value <= 0 {
			return query, fmt.Errorf("操作人编号无效")
		}
		query.OperatorID = value
	}
	query.Action = strings.TrimSpace(r.GetQuery("action").String())
	if len(query.Action) > 64 {
		return query, fmt.Errorf("操作类型无效")
	}
	query.Success = strings.TrimSpace(r.GetQuery("success").String())
	if query.Success != "" && query.Success != "success" && query.Success != "failed" {
		return query, fmt.Errorf("操作结果无效")
	}
	query.StartAt = strings.TrimSpace(r.GetQuery("startAt").String())
	query.EndAt = strings.TrimSpace(r.GetQuery("endAt").String())
	for _, value := range []string{query.StartAt, query.EndAt} {
		if value != "" {
			if _, err := time.Parse("2006-01-02 15:04:05", value); err != nil {
				return query, fmt.Errorf("日志时间格式无效")
			}
		}
	}
	if query.StartAt != "" && query.EndAt != "" && query.StartAt > query.EndAt {
		return query, fmt.Errorf("日志开始时间不能晚于结束时间")
	}
	return query, nil
}

func listAuditOperators(r *ghttp.Request) {
	list, err := service.DB().Model("users").Fields("id,username,role").Order("username ASC").All()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取日志操作人失败")
		return
	}
	writeJSON(r, list.List())
}
