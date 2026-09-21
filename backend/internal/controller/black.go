package controller

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gogf/gf/v2/database/gdb"
	"github.com/gogf/gf/v2/net/ghttp"

	"backend/internal/consts"
	"backend/internal/model"
	"backend/internal/service"
)

func listBlacklist(r *ghttp.Request) {
	page, pageSize := queryPage(r)
	m := service.DB().Model("blacklist b").LeftJoin("users u", "u.id=b.user_id").Fields("b.id,b.user_id,b.ip,b.created_at,b.updated_at,u.username").Page(page, pageSize).Order("b.id DESC")
	if role(r) != consts.RoleAdmin {
		m = m.Where("b.user_id", userID(r))
	} else if value := r.GetQuery("userId").String(); value != "" {
		m = m.Where("b.user_id", value)
	}
	list, total, err := m.AllAndCount(false)
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取黑名单失败")
		return
	}
	writeJSON(r, map[string]any{"list": list.List(), "total": total})
}

func createBlacklist(r *ghttp.Request) {
	var req model.BlacklistRequest
	if err := r.Parse(&req); err != nil || strings.TrimSpace(req.IP) == "" {
		writeError(r, http.StatusBadRequest, "IP 不能为空")
		return
	}
	if role(r) != consts.RoleAdmin {
		req.UserID = userID(r)
	}
	if req.UserID <= 0 {
		writeError(r, http.StatusBadRequest, "归属用户不能为空")
		return
	}
	setAuditTargetUser(r, req.UserID)
	_, err := service.DB().Model("blacklist").Data(gdb.Map{"user_id": req.UserID, "ip": strings.TrimSpace(req.IP)}).OnDuplicate("user_id,ip").Save()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "保存黑名单失败")
		return
	}
	writeJSON(r, map[string]string{"message": "已加入黑名单"})
}

func deleteBlacklist(r *ghttp.Request) {
	id, ok := parseID(r, "id")
	if !ok {
		writeError(r, http.StatusBadRequest, "黑名单编号无效")
		return
	}
	m := service.DB().Model("blacklist").Where("id", id)
	if role(r) != consts.RoleAdmin {
		m = m.Where("user_id", userID(r))
	}
	if _, err := m.Delete(); err != nil {
		writeError(r, http.StatusInternalServerError, "移除黑名单失败")
		return
	}
	writeJSON(r, map[string]string{"message": "已移除"})
}

func batchBlacklist(r *ghttp.Request) {
	var req model.BatchIDsRequest
	if err := r.Parse(&req); err != nil || req.Action != "delete" {
		writeError(r, http.StatusBadRequest, "黑名单批量操作无效")
		return
	}
	if err := validateBatchIDs(req.IDs); err != nil {
		writeError(r, http.StatusBadRequest, err.Error())
		return
	}
	if value := strings.TrimSpace(r.GetQuery("userId").String()); value != "" {
		if targetUserID, parseErr := strconv.ParseInt(value, 10, 64); parseErr == nil {
			setAuditTargetUser(r, targetUserID)
		}
	}
	setAuditTargetIDs(r, req.IDs)
	// 2026-09-13 10:05:31 CST：按普通用户的数据范围校验所有黑名单 ID 后再批量删除，避免跨用户越权和半成功结果。
	err := service.DB().Transaction(requestContext(r), func(ctx context.Context, tx gdb.TX) error {
		m := tx.Model("blacklist").WhereIn("id", req.IDs)
		if role(r) != consts.RoleAdmin {
			m = m.Where("user_id", userID(r))
		}
		count, err := m.Count()
		if err != nil {
			return fmt.Errorf("读取黑名单失败: %w", err)
		}
		if count != len(req.IDs) {
			return fmt.Errorf("部分黑名单记录不存在或无权限，未执行任何操作")
		}
		_, err = m.Delete()
		return err
	})
	if err != nil {
		writeError(r, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(r, map[string]string{"message": "批量移除成功"})
}

func isBlocked(ctxr *ghttp.Request, ownerID int64) bool {
	count, err := service.DB().Model("blacklist").Where("user_id", ownerID).Where("ip", ctxr.GetClientIp()).Count()
	return err == nil && count > 0
}
