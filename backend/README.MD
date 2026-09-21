# 即时信息问答后端

## 启动

后端默认读取 `manifest/config/config.yaml`，连接本机：

- MySQL：`127.0.0.1:3306`，账号/密码/数据库均为 `cheat_gf`
- Redis：`127.0.0.1:6379`，DB `11`，密码 `qq837226`

```bash
GOCACHE=/tmp/cheat-gf-gocache GOPATH=/tmp/cheat-gf-gopath go run .
```

首次启动会自动创建业务表并写入管理员：`admin / admin123`。生产环境请覆盖 JWT 密钥。

## 主要接口

- `POST /api/auth/login`：管理员/用户登录
- `GET /api/visitor-links`：生成当前用户的 10 个模板链接
- `GET /api/public/module-data/:module?token=...&keys=item1,item2`：App 根据 ITEM_KEYS 获取对应 value
- `POST /api/public/visitors/submit`：App 统一提交访客表单
- `GET /ws?module=module1&item1=...&token=...`：App 在填写 item1 后建立按用户和 item1 绑定的实时连接
- `GET /api/ws?token=JWT`：Admin 访客更新订阅及定向 module 跳转命令

App 端 module 页面保持空白，业务方通过 `ITEM_KEYS` 和 module 数据上下文自行渲染页面。
