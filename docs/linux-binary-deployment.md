# Linux ZIP 打包与部署

本机一条命令生成 AES-256 加密 ZIP，包含 Linux 后端二进制、Admin 前端静态文件和后端启动脚本。ZIP 外另生成 Linux 解密部署脚本；上传两个文件后由部署脚本解密，并安装到指定后端目录和现有 Nginx 站点目录。Linux 不需要安装 Go、Node.js 或 pnpm。

## 1. 本机一键打包

本机需要 Go、Node.js、pnpm 和支持 AES 加密的 7-Zip 命令（`7z` 或 `7zz`）。首次使用前，在 `scripts/build-linux.sh` 和 `scripts/deploy-linux.sh` 中将 `PACKAGE_PASSWORD` 改成相同的随机值，至少 16 个字母、数字、点、下划线或连字符；未修改占位值或两边不一致时，脚本会拒绝运行。此后在项目根目录执行：

```bash
scripts/build-linux.sh -v 261001.001
```

`-v` 必填，版本号使用数字和点号，例如 `261001.001`。`-limit` 是可选的编译时普通用户上限，默认 5；管理员不计入、禁用用户仍计入，设置为 `0` 时无限制。例如：

```bash
scripts/build-linux.sh -v 261001.001 -limit 10
scripts/build-linux.sh -v 261001.001 -limit 0
```

上限编译进后端二进制，部署和运行时不再设置。打包命令会生成加密包 `output/cheat-gf-linux-amd64-v261001.001.zip`、对应 `.sha256` 校验文件，以及 ZIP 外的部署脚本 `output/deploy-linux-amd64-v261001.001.sh`。该版本同时写入 ZIP 根目录的 `VERSION` 文件、后端二进制和前端构建，因此会在后端接口、Admin 页脚和 H5 浏览器标签中显示。ZIP 内有：

- `backend/cheat-gf`：Linux 后端二进制
- `backend/manifest/config/config.yaml.example`：运行配置模板
- `backend/start.sh`：后端 nohup 启停脚本
- `frontend/`：Admin 前端构建文件
- `VERSION`：本次打包使用的版本号

构建脚本负责 ZIP 加密，部署脚本负责解密。部署脚本需要和 ZIP 一起交给 Linux；因此能读取部署脚本的人也能取得其中的密码并解开 ZIP。该方案适合防止 ZIP 单独泄露时被直接读取，不适合作为防止部署人员访问内容的权限边界。

目标服务器为 ARM64 时，用 `GOARCH=arm64 scripts/build-linux.sh -v 261001.001` 打包，并确保 Linux 架构一致。若前端使用不同域名的 API，可在打包前设置 `VITE_PRO_API_BASE_URL`；Nginx 同源反代时保持默认配置。

Admin 全局页脚显示 `版本 v261001.001`；H5 浏览器标签标题保持为空。后端公开 `GET /api/version` 返回版本，`GET /health` 也包含版本字段：

```json
{"code":0,"data":{"version":"261001.001"},"message":"ok"}
```

## 2. 上传并解密部署

把 ZIP、同名 `.sha256` 校验文件和对应部署脚本一起上传到 Linux 服务器。服务器需要 `bash`、`coreutils` 和支持 AES 加密的 7-Zip 命令（`7z` 或 `7zz`）。Linux 上部署脚本的 `PACKAGE_PASSWORD` 也必须与构建脚本完全相同。先校验 ZIP（文件名按实际版本替换）：

```bash
sha256sum -c cheat-gf-linux-amd64-v261001.001.zip.sha256
```

## 3. 部署到后端目录和 Nginx 站点目录

后端目录和前端站点目录由你现有的部署结构决定。把下面两个路径替换为真实路径：

```bash
sudo bash ./deploy-linux-amd64-v261001.001.sh \
  ./cheat-gf-linux-amd64-v261001.001.zip \
  /opt/cheat-gf/backend \
  /var/www/example.com
```

部署脚本会将 ZIP 解密到临时目录，再把二进制、配置模板和启动脚本放到第一个目录，将前端静态文件复制到第二个目录，结束后删除临时解密文件。它不会清理站点目录中的其他文件；后端已有的 `manifest/config/config.yaml` 也会保留。首次部署会从模板创建配置文件：

```text
/opt/cheat-gf/backend/manifest/config/config.yaml
```

编辑配置，至少设置正确的 MySQL DSN、Redis 密码和强随机 `app.jwtSecret`，不要保留模板中的 `CHANGE_ME`。Redis 数据库编号由程序固定使用 `11`。默认监听地址为 `127.0.0.1:5000`，可按需修改配置中的 `server.address`。

部署用户需要对后端目录和 Nginx 站点目录有写权限。若通过 `sudo` 执行部署，后续也要使用相同用户管理进程，或调整文件属主。

首次部署并完成配置后，在后端目录通过交互式终端创建第一个管理员，密码输入时不会回显：

```bash
cd /opt/cheat-gf/backend
./cheat-gf create-admin
```

有管理员的现有数据库无需运行该命令；命令会拒绝重复创建。应用正常启动时不会自动写入管理员账号。

## 4. 使用启动脚本管理后端

启动脚本位于后端目录，支持 `start`、`stop`、`restart` 和 `status`。普通用户数量上限已在打包时编译进二进制，运行时无需追加参数：

```bash
/opt/cheat-gf/backend/start.sh start
/opt/cheat-gf/backend/start.sh status
tail -f /opt/cheat-gf/backend/logs/backend.log
curl -fsS http://127.0.0.1:5000/health
```

停止或重启：

```bash
/opt/cheat-gf/backend/start.sh stop
/opt/cheat-gf/backend/start.sh restart
```

启动脚本从后端目录运行二进制，以便程序读取 `manifest/config/config.yaml`；PID 和日志分别保存在 `run/backend.pid`、`logs/backend.log`。更新版本时，上传新版本 ZIP、校验文件和 ZIP 外的部署脚本，再运行部署脚本。部署脚本会先停止旧进程，然后替换后端文件并覆盖/新增前端构建文件，最后按需运行 `start.sh start`。

## 5. Nginx 反向代理

把 Nginx `root` 设置为刚才传入的前端站点目录。将 `example.com` 和目录替换为你的站点信息：

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/example.com;
    index index.html;

    location = /health {
        proxy_pass http://127.0.0.1:5000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /ws {
        proxy_pass http://127.0.0.1:5000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
    }

    location = /api/ws {
        proxy_pass http://127.0.0.1:5000/api/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

确认后重载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

`/ws` 是 H5 实时连接，`/api/ws` 是 Admin 实时连接，二者需要 WebSocket Upgrade 头。`try_files` 支持 Admin 的前端路由。公网使用时建议配置 HTTPS；MySQL、Redis 和后端 `5000` 端口只允许本机或内网访问。
