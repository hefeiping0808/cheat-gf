package controller

import (
	"net/http"
	"strings"
	"time"

	"github.com/gogf/gf/v2/database/gdb"
	"github.com/gogf/gf/v2/net/ghttp"

	"backend/internal/consts"
	"backend/internal/model"
	"backend/internal/service"
)

func login(r *ghttp.Request) {
	var req model.LoginRequest
	if err := r.Parse(&req); err != nil || strings.TrimSpace(req.Username) == "" || req.Password == "" {
		writeError(r, http.StatusBadRequest, "用户名和密码不能为空")
		return
	}
	record, err := service.DB().Model("users").Where("username", req.Username).One()
	if err != nil || record.IsEmpty() || record["disabled"].Bool() || !service.CheckPassword(req.Password, record["password"].String()) {
		writeError(r, http.StatusUnauthorized, "用户名或密码错误")
		return
	}
	claims := service.JWTClaims{UserID: record["id"].Int64(), Role: record["role"].String(), IP: r.GetClientIp(), Exp: time.Now().Add(12 * time.Hour).Unix()}
	accessToken, err := service.CreateJWT(claims)
	if err != nil {
		writeError(r, http.StatusInternalServerError, "生成登录令牌失败")
		return
	}
	// 2026-09-13 10:20:00 CST：登录成功后将认证用户写入审计上下文，使登录日志也能按操作人筛选。
	r.SetCtxVar(consts.CtxUserID, record["id"].Int64())
	r.SetCtxVar(consts.CtxRole, record["role"].String())
	writeJSON(r, map[string]any{"accessToken": accessToken, "refreshToken": accessToken, "user": userRecord(record)})
}

// changePassword 只返回稳定的英文错误码，避免后端文案阻断管理端国际化。
// 更新时间：2026-09-10 11:13:36 CST。
func changePassword(r *ghttp.Request) {
	var req model.ChangePasswordRequest
	if err := r.Parse(&req); err != nil || req.CurrentPassword == "" || req.NewPassword == "" {
		writeErrorCode(r, http.StatusBadRequest, "PWD_REQUIRED")
		return
	}
	if len([]rune(req.NewPassword)) < 6 {
		writeErrorCode(r, http.StatusBadRequest, "PWD_TOO_SHORT")
		return
	}
	record, err := service.DB().Model("users").Where("id", userID(r)).One()
	if err != nil || record.IsEmpty() || !service.CheckPassword(req.CurrentPassword, record["password"].String()) {
		writeErrorCode(r, http.StatusBadRequest, "PWD_ERROR")
		return
	}
	hash, err := service.HashPassword(req.NewPassword)
	if err != nil {
		writeErrorCode(r, http.StatusInternalServerError, "PWD_UPDATE_FAILED")
		return
	}
	if _, err = service.DB().Model("users").Where("id", userID(r)).Data(gdb.Map{"password": hash}).Update(); err != nil {
		writeErrorCode(r, http.StatusInternalServerError, "PWD_UPDATE_FAILED")
		return
	}
	writeJSON(r, map[string]string{"message": "PWD_UPDATED"})
}

func refresh(r *ghttp.Request) {
	claims, err := service.ParseJWT(bearerToken(r), r.GetClientIp())
	if err != nil {
		writeError(r, http.StatusUnauthorized, "刷新令牌无效")
		return
	}
	claims.Exp = time.Now().Add(12 * time.Hour).Unix()
	token, err := service.CreateJWT(claims)
	if err != nil {
		writeError(r, http.StatusInternalServerError, "刷新令牌失败")
		return
	}
	writeJSON(r, map[string]string{"accessToken": token, "refreshToken": token})
}

func authUser(r *ghttp.Request) {
	record, err := service.DB().Model("users").Where("id", userID(r)).One()
	if err != nil || record.IsEmpty() {
		writeError(r, http.StatusUnauthorized, "用户不存在")
		return
	}
	writeJSON(r, userRecord(record))
}

func authPermissions(r *ghttp.Request) {
	permissions := []string{"user:view", "visitor:view", "blacklist:view", "mapping:view", "dictionary:view", "template:view", "audit:view"}
	if role(r) != consts.RoleAdmin {
		// 2026-09-10 14:12:02 CST：普通用户仅管理黑名单和访客数据，不应看到系统管理菜单或进入模板配置页面。
		// 触发场景：Admin 菜单按权限递归过滤；只要 mapping/template 权限存在，系统管理仍会显示。
		// 维护注意：路由权限表需与此处保持一致，新增系统配置权限时默认只授予管理员。
		permissions = []string{"visitor:view", "blacklist:view"}
	}
	writeJSON(r, permissions)
}

func userRecord(record gdb.Record) map[string]any {
	return map[string]any{
		"id": record["id"].Int64(), "username": record["username"].String(), "code": record["code"].String(), "role": record["role"].String(),
		"disabled": record["disabled"].Bool(), "createdAt": record["created_at"].String(), "updatedAt": record["updated_at"].String(),
	}
}
