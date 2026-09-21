package service

import (
	"context"
	"encoding/json"

	"github.com/gogf/gf/v2/frame/g"
)

// AuditLogEntry 是管理员和普通用户业务操作的审计快照，写入失败只记录服务端错误，不阻断原业务响应。
// 更新时间：2026-09-13 10:20:00 CST。
type AuditLogEntry struct {
	OperatorID   int64
	Action       string
	TargetType   string
	TargetIDs    []int64
	TargetRef    string
	TargetUserID int64
	RequestIP    string
	Success      bool
	ErrorMessage string
}

func WriteAuditLog(ctx context.Context, entry AuditLogEntry) {
	if entry.TargetIDs == nil {
		entry.TargetIDs = []int64{}
	}
	targetIDs, err := json.Marshal(entry.TargetIDs)
	if err != nil {
		g.Log().Errorf(ctx, "marshal audit target ids failed: %v", err)
		return
	}
	var operatorUsername string
	if entry.OperatorID > 0 {
		operator, queryErr := DB().Model("users").Fields("username").Where("id", entry.OperatorID).One()
		if queryErr == nil && !operator.IsEmpty() {
			operatorUsername = operator["username"].String()
		}
	}
	data := map[string]any{
		"operator_id":       nullableInt64(entry.OperatorID),
		"operator_username": operatorUsername,
		"target_user_id":    nullableInt64(entry.TargetUserID),
		"action":            entry.Action,
		"target_type":       entry.TargetType,
		"target_ids":        string(targetIDs),
		"target_ref":        entry.TargetRef,
		"request_ip":        entry.RequestIP,
		"success":           entry.Success,
		"error_message":     entry.ErrorMessage,
	}
	if _, err = DB().Model("audit_logs").Data(data).Insert(); err != nil {
		g.Log().Errorf(ctx, "write audit log failed: %v", err)
	}
}

func nullableInt64(value int64) any {
	if value <= 0 {
		return nil
	}
	return value
}
