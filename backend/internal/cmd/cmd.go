package cmd

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/gogf/gf/v2/frame/g"
	"github.com/gogf/gf/v2/net/ghttp"
	"github.com/gogf/gf/v2/os/gcmd"
	"golang.org/x/crypto/ssh/terminal"

	"backend/internal/controller"
	"backend/internal/service"
)

var (
	Main = gcmd.Command{
		Name:  "main",
		Usage: "main",
		Brief: "start http server",
		Func: func(ctx context.Context, parser *gcmd.Parser) (err error) {
			if err = service.Migrate(ctx); err != nil {
				// 数据库未启动时保留 HTTP 服务，便于先查看接口文档；首次业务请求会返回明确错误。
				g.Log().Errorf(ctx, "数据库迁移失败: %v", err)
			}
			s := g.Server()
			s.Group("/", func(group *ghttp.RouterGroup) {
				controller.RegisterRoutes(group)
			})
			s.Run()
			return nil
		},
	}
	CreateAdmin = gcmd.Command{
		Name:  "create-admin",
		Usage: "create-admin",
		Brief: "interactively create the first administrator",
		Func: func(ctx context.Context, _ *gcmd.Parser) error {
			if err := service.Migrate(ctx); err != nil {
				return fmt.Errorf("初始化数据库失败: %w", err)
			}

			var username string
			fmt.Fprint(os.Stdout, "管理员用户名: ")
			if _, err := fmt.Fscanln(os.Stdin, &username); err != nil {
				return fmt.Errorf("读取用户名失败: %w", err)
			}

			password, err := readHiddenPassword("管理员密码: ")
			if err != nil {
				return err
			}
			confirm, err := readHiddenPassword("再次输入密码: ")
			if err != nil {
				return err
			}
			if string(password) != string(confirm) {
				return fmt.Errorf("两次输入的密码不一致")
			}
			if err := service.CreateAdmin(ctx, username, string(password)); err != nil {
				return err
			}
			fmt.Fprintln(os.Stdout, "管理员创建成功。")
			return nil
		},
	}
)

func init() {
	if err := Main.AddCommand(&CreateAdmin); err != nil {
		panic(err)
	}
}

// readHiddenPassword 在终端关闭回显，避免初始化管理员密码出现在屏幕或 shell 历史中。
// 触发场景：执行 create-admin 并输入或确认密码；维护注意：命令需从交互式终端运行。
// 更新时间：2026-10-02 12:52:39 CST。
func readHiddenPassword(prompt string) ([]byte, error) {
	fmt.Fprint(os.Stdout, prompt)
	password, err := terminal.ReadPassword(int(os.Stdin.Fd()))
	fmt.Fprintln(os.Stdout)
	if err != nil {
		return nil, fmt.Errorf("读取密码失败（请在交互式终端执行）: %w", err)
	}
	if strings.TrimSpace(string(password)) == "" {
		return nil, fmt.Errorf("密码不能为空")
	}
	return password, nil
}
