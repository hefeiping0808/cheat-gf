# 即时信息问答后端

## 启动

Linux ZIP 打包、部署到现有后端目录和 Nginx 站点目录、nohup 进程管理及反向代理见 [Linux 部署指南](../docs/linux-binary-deployment.md)。

后端默认读取 `manifest/config/config.yaml`，连接本机：

- MySQL：`127.0.0.1:3306`，账号/密码/数据库均为 `cheat_gf`
- Redis：`127.0.0.1:6379`，DB `11`，密码 `qq837226`

```bash
GOCACHE=/tmp/cheat-gf-gocache GOPATH=/tmp/cheat-gf-gopath go run .
```

Linux 发布包编译时默认最多创建 5 个普通用户（管理员不计入，禁用用户仍计入）。打包命令可通过 `-limit` 固化上限，`0` 表示无限制：

```bash
# 在项目根目录执行
scripts/build-linux.sh -v 261002.001 -limit 10
scripts/build-linux.sh -v 261002.001 -limit 0
```

上限保存在编译出的二进制中，运行 `start.sh start` 时无需再传参数；普通 `go run .` 开发运行保持默认 5。

首次启动会自动创建业务表，但不会生成默认管理员。数据库初始化后，在后端目录通过交互命令创建第一个管理员；密码不会回显：

```bash
./cheat-gf create-admin
```

开发环境也可以在 `backend/` 目录执行 `go run . create-admin`。命令只允许在尚无管理员时初始化第一个管理员，已有账号不会被覆盖或删除。生产环境请覆盖 JWT 密钥。

## 主要接口

- `POST /api/auth/login`：管理员/用户登录
- `GET /api/visitor-links`：生成当前用户的 10 个模板链接
- `GET /api/public/module-data/:module?token=...&keys=item1,item2`：App 根据 ITEM_KEYS 获取对应 value
- `POST /api/public/visitors/submit`：App 统一提交访客表单
- `GET /ws?module=module1&item1=...&token=...`：App 在填写 item1 后建立按用户和 item1 绑定的实时连接
- `GET /api/ws?token=JWT`：Admin 访客更新订阅及定向 module 跳转命令

App 端 module 页面保持空白，业务方通过 `ITEM_KEYS` 和 module 数据上下文自行渲染页面。
