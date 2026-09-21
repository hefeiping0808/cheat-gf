package cmd

import (
	"context"

	"github.com/gogf/gf/v2/frame/g"
	"github.com/gogf/gf/v2/net/ghttp"
	"github.com/gogf/gf/v2/os/gcmd"

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
)
