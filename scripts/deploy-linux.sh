#!/usr/bin/env bash
set -euo pipefail

# 2026-10-02 10:21:44 CST：必须与 build-linux.sh 的密码完全一致；限制字符避免 shell 展开部署密钥。
PACKAGE_PASSWORD="tS8sG4fG4uQ3nX8mJ6mP8vP5kB6kM4nP"

if [[ "$PACKAGE_PASSWORD" == "CHANGE_ME_TO_A_LONG_RANDOM_PASSWORD" || ! "$PACKAGE_PASSWORD" =~ ^[A-Za-z0-9._-]{16,}$ ]]; then
  echo "Set PACKAGE_PASSWORD in deploy-linux.sh to match build-linux.sh (16+ letters, digits, dots, underscores, or hyphens)." >&2
  exit 2
fi

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 ENCRYPTED_ZIP BACKEND_DIR NGINX_SITE_DIR" >&2
  echo "Example: $0 ./cheat-gf-linux-amd64-v261001.001.zip /opt/cheat-gf/backend /var/www/example.com" >&2
  exit 2
fi

ARCHIVE_INPUT="$1"
BACKEND_DIR="$2"
FRONTEND_DIR="$3"
if [[ ! -f "$ARCHIVE_INPUT" ]]; then
  echo "Encrypted ZIP not found: $ARCHIVE_INPUT" >&2
  exit 2
fi
if [[ "$BACKEND_DIR" != /* || "$FRONTEND_DIR" != /* ]]; then
  echo "Backend and Nginx site directories must be absolute paths." >&2
  exit 2
fi

ARCHIVE_DIR="$(cd "$(dirname "$ARCHIVE_INPUT")" && pwd)"
ARCHIVE_PATH="$ARCHIVE_DIR/$(basename "$ARCHIVE_INPUT")"
if command -v 7zz >/dev/null 2>&1; then
  SEVEN_ZIP="$(command -v 7zz)"
elif command -v 7z >/dev/null 2>&1; then
  SEVEN_ZIP="$(command -v 7z)"
else
  echo "Required command not found: 7zz or 7z (7-Zip with AES support)." >&2
  exit 2
fi

STAGING_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGING_DIR"' EXIT
echo "==> Decrypting package into temporary staging directory"
# 2026-10-02 10:23:10 CST：先在临时目录完成 AES 解密和文件结构校验，避免半包内容进入线上目录。
"$SEVEN_ZIP" x "$ARCHIVE_PATH" "-p$PACKAGE_PASSWORD" "-o$STAGING_DIR" -y

if [[ ! -x "$STAGING_DIR/backend/cheat-gf" || ! -f "$STAGING_DIR/backend/manifest/config/config.yaml.example" || ! -f "$STAGING_DIR/backend/start.sh" || ! -d "$STAGING_DIR/frontend" || ! -f "$STAGING_DIR/VERSION" ]]; then
  echo "The decrypted ZIP does not contain the expected backend and frontend files." >&2
  exit 2
fi

mkdir -p "$BACKEND_DIR" "$FRONTEND_DIR"

# 部署前先停掉该后端目录管理的旧进程，避免覆盖运行中的二进制后 PID 校验失效。
if [[ -x "$BACKEND_DIR/start.sh" ]]; then
  "$BACKEND_DIR/start.sh" stop
fi

install -m 755 "$STAGING_DIR/backend/cheat-gf" "$BACKEND_DIR/cheat-gf"
install -m 755 "$STAGING_DIR/backend/start.sh" "$BACKEND_DIR/start.sh"
mkdir -p "$BACKEND_DIR/manifest/config"
install -m 644 "$STAGING_DIR/backend/manifest/config/config.yaml.example" "$BACKEND_DIR/manifest/config/config.yaml.example"

# 首次部署初始化配置模板；再次部署保留线上已编辑的 config.yaml。
if [[ ! -f "$BACKEND_DIR/manifest/config/config.yaml" ]]; then
  install -m 600 "$STAGING_DIR/backend/manifest/config/config.yaml.example" "$BACKEND_DIR/manifest/config/config.yaml"
  echo "Created $BACKEND_DIR/manifest/config/config.yaml; edit MySQL, Redis, and app.jwtSecret before starting the backend."
fi

# 只覆盖本应用的静态文件，不清理站点目录中的其他文件。
cp -R "$STAGING_DIR/frontend/." "$FRONTEND_DIR/"
DEPLOYED_VERSION="$(cat "$STAGING_DIR/VERSION")"
printf '%s\n' "$DEPLOYED_VERSION" > "$BACKEND_DIR/VERSION"

echo "Deployment files installed (version $DEPLOYED_VERSION)."
echo "  Backend:  $BACKEND_DIR"
echo "  Frontend: $FRONTEND_DIR"
echo "Edit the backend config if needed, then run: $BACKEND_DIR/start.sh start"
