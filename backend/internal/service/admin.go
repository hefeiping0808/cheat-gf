package service

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/gogf/gf/v2/database/gdb"
)

// CreateAdmin 仅由显式 CLI 命令调用，避免应用启动时写入任何固定管理员凭据。
// 触发场景：新部署初始化首个管理员；已有管理员时拒绝重复创建，防止覆盖或意外增加特权账号。
// 维护注意：不要将该函数重新接入 Migrate；管理员密码必须来自交互输入并继续使用 bcrypt 保存。
// 更新时间：2026-10-02 12:52:39 CST。
func CreateAdmin(ctx context.Context, username, password string) error {
	username = strings.TrimSpace(username)
	if username == "" || utf8.RuneCountInString(username) > 64 {
		return fmt.Errorf("用户名不能为空且不能超过 64 个字符")
	}
	if password == "" {
		return fmt.Errorf("密码不能为空")
	}
	count, err := DB().Model("users").Where("role", "admin").Count()
	if err != nil {
		return fmt.Errorf("检查管理员账户失败: %w", err)
	}
	if count > 0 {
		return fmt.Errorf("系统已存在管理员；为避免覆盖现有账号，本命令只用于初始化第一个管理员")
	}
	hash, err := HashPassword(password)
	if err != nil {
		return fmt.Errorf("生成密码摘要失败: %w", err)
	}
	// 首次初始化时生成唯一用户 code；碰撞时重试，和普通用户创建的策略保持一致。
	for attempt := 0; attempt < 5; attempt++ {
		code, codeErr := GenerateUserCode()
		if codeErr != nil {
			return fmt.Errorf("生成用户 code 失败: %w", codeErr)
		}
		_, err = DB().Model("users").Data(gdb.Map{
			"username": username,
			"code":     code,
			"password": hash,
			"role":     "admin",
		}).Insert()
		if err == nil {
			return nil
		}
	}
	return fmt.Errorf("创建管理员失败（用户名可能已存在）: %w", err)
}
