#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GOARCH="${GOARCH:-amd64}"
VERSION=""
# 2026-10-02 18:35:50 CST：上限只在本机打包时选择并编译进后端二进制，Linux 启动脚本不接受覆盖值。
# 触发场景：发布方需要按交付对象设置普通用户容量；省略为 5，0 为无限制，负数和非数字在打包前拒绝。
USER_LIMIT="5"
# 2026-10-02 10:21:44 CST：打包密码必须与 deploy-linux.sh 中一致，且避免 shell 特殊字符被展开。
PACKAGE_PASSWORD="tS8sG4fG4uQ3nX8mJ6mP8vP5kB6kM4nP"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -v)
      if [[ $# -lt 2 || -z "$2" ]]; then
        echo "Option -v requires a version, for example: -v 261001.001" >&2
        exit 2
      fi
      VERSION="$2"
      shift 2
      ;;
    -limit)
      if [[ $# -lt 2 || -z "$2" ]]; then
        echo "Option -limit requires a non-negative integer (0 means unlimited)." >&2
        exit 2
      fi
      USER_LIMIT="$2"
      shift 2
      ;;
    -limit=*)
      USER_LIMIT="${1#*=}"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 -v VERSION [-limit N]" >&2
      exit 2
      ;;
  esac
done

if [[ ! "$VERSION" =~ ^[0-9]+([.][0-9]+)*$ ]]; then
  echo "A numeric dotted version is required, for example: 261001.001" >&2
  exit 2
fi
if [[ ! "$USER_LIMIT" =~ ^[0-9]+$ ]]; then
  echo "Option -limit must be a non-negative integer; use 0 for unlimited." >&2
  exit 2
fi
if [[ "$PACKAGE_PASSWORD" == "CHANGE_ME_TO_A_LONG_RANDOM_PASSWORD" || ! "$PACKAGE_PASSWORD" =~ ^[A-Za-z0-9._-]{16,}$ ]]; then
  echo "Set PACKAGE_PASSWORD in build-linux.sh to at least 16 letters, digits, dots, underscores, or hyphens." >&2
  exit 2
fi
DEPLOY_PASSWORD="$(awk -F '"' '/^PACKAGE_PASSWORD=/ { print $2; exit }' "$ROOT_DIR/scripts/deploy-linux.sh")"
if [[ "$DEPLOY_PASSWORD" != "$PACKAGE_PASSWORD" ]]; then
  echo "PACKAGE_PASSWORD must match in build-linux.sh and deploy-linux.sh." >&2
  exit 2
fi

case "$GOARCH" in
  amd64|arm64) ;;
  *) echo "GOARCH must be amd64 or arm64 (got: $GOARCH)" >&2; exit 2 ;;
esac

for tool in go pnpm; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Required command not found: $tool" >&2
    exit 2
  fi
done
if command -v 7zz >/dev/null 2>&1; then
  SEVEN_ZIP="$(command -v 7zz)"
elif command -v 7z >/dev/null 2>&1; then
  SEVEN_ZIP="$(command -v 7z)"
else
  echo "Required command not found: 7zz or 7z (7-Zip with AES support)." >&2
  exit 2
fi

OUTPUT_DIR="$ROOT_DIR/output"
PACKAGE_NAME="cheat-gf-linux-$GOARCH-v$VERSION"
PACKAGE_DIR="$OUTPUT_DIR/$PACKAGE_NAME"
ARCHIVE="$OUTPUT_DIR/$PACKAGE_NAME.zip"
DEPLOY_SCRIPT="$OUTPUT_DIR/deploy-linux-$GOARCH-v$VERSION.sh"

mkdir -p "$OUTPUT_DIR"
rm -rf "$PACKAGE_DIR" "$ARCHIVE" "$ARCHIVE.sha256" "$DEPLOY_SCRIPT"
mkdir -p "$PACKAGE_DIR/backend/manifest/config" "$PACKAGE_DIR/frontend"
trap 'rm -rf "$PACKAGE_DIR"' EXIT

(
  # 2026-10-02 10:37:27 CST：在 Admin 包目录启动 Corepack，并以 CI 模式允许 pnpm 重建 node_modules。
  # 触发场景：Corepack 默认版本与项目固定版本不同时，或无 TTY 打包需要清理不兼容依赖目录时。
  cd "$ROOT_DIR/admin"
  echo "==> Installing Admin dependencies"
  CI=true pnpm install --frozen-lockfile

  echo "==> Building Admin static files"
  VITE_APP_VERSION="$VERSION" pnpm build
)
cp -R "$ROOT_DIR/admin/dist/." "$PACKAGE_DIR/frontend/"

echo "==> Cross-compiling backend for Linux/$GOARCH"
(
  cd "$ROOT_DIR/backend"
  CGO_ENABLED=0 GOOS=linux GOARCH="$GOARCH" go build \
    -trimpath \
    -ldflags="-s -w -X backend/internal/service.Version=$VERSION -X backend/internal/controller.compiledMaxRegularUsers=$USER_LIMIT" \
    -o "$PACKAGE_DIR/backend/cheat-gf" \
    .
)
chmod 755 "$PACKAGE_DIR/backend/cheat-gf"

cp "$ROOT_DIR/backend/manifest/config/config.yaml.example" "$PACKAGE_DIR/backend/manifest/config/config.yaml.example"
cp "$ROOT_DIR/scripts/start-linux.sh" "$PACKAGE_DIR/backend/start.sh"
cp "$ROOT_DIR/scripts/deploy-linux.sh" "$DEPLOY_SCRIPT"
chmod 755 "$DEPLOY_SCRIPT" "$PACKAGE_DIR/backend/start.sh"
printf '%s\n' "$VERSION" > "$PACKAGE_DIR/VERSION"

echo "==> Creating AES-256 encrypted ZIP package"
(cd "$PACKAGE_DIR" && "$SEVEN_ZIP" a -tzip -mem=AES256 "-p$PACKAGE_PASSWORD" "$ARCHIVE" backend frontend VERSION)
ARCHIVE_NAME="$(basename "$ARCHIVE")"
if command -v shasum >/dev/null 2>&1; then
  (cd "$OUTPUT_DIR" && shasum -a 256 "$ARCHIVE_NAME" > "$ARCHIVE_NAME.sha256")
else
  (cd "$OUTPUT_DIR" && sha256sum "$ARCHIVE_NAME" > "$ARCHIVE_NAME.sha256")
fi

echo "Package complete:"
echo "  ZIP:    $ARCHIVE"
echo "  SHA256: $ARCHIVE.sha256"
echo "  Deploy: $DEPLOY_SCRIPT"
