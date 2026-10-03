#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$APP_DIR/cheat-gf"
PID_FILE="$APP_DIR/run/backend.pid"
LOG_FILE="$APP_DIR/logs/backend.log"
ACTION="${1:-start}"

read_pid() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  printf '%s\n' "$pid"
}

is_app_process() {
  local pid="$1" exe
  kill -0 "$pid" 2>/dev/null || return 1
  exe="$(readlink -f "/proc/$pid/exe" 2>/dev/null || true)"
  [[ "$exe" == "$BIN" ]]
}

case "$ACTION" in
  start)
    # 2026-10-02 12:38:04 CST：用 Bash 条件表达式检查二进制，避免把 -x 当作外部命令执行。
    # 触发场景：用户运行 start.sh start；维护时文件检查都使用 [[ ... ]]，并保留失败提示。
    if [[ ! -x "$BIN" ]]; then
      echo "Backend binary not found or not executable: $BIN" >&2
      exit 1
    fi
    if [[ ! -f "$APP_DIR/manifest/config/config.yaml" ]]; then
      echo "Backend config not found: $APP_DIR/manifest/config/config.yaml" >&2
      exit 1
    fi
    if pid="$(read_pid)" && is_app_process "$pid"; then
      echo "Backend is already running (PID $pid)."
      exit 0
    fi
    mkdir -p "$APP_DIR/run" "$APP_DIR/logs"
    rm -f "$PID_FILE"
    (
      cd "$APP_DIR"
      nohup ./cheat-gf >> "$LOG_FILE" 2>&1 < /dev/null &
      echo "$!" > "$PID_FILE"
    )
    sleep 1
    pid="$(read_pid || true)"
    if [[ -n "$pid" ]] && is_app_process "$pid"; then
      echo "Backend started (PID $pid). Log: $LOG_FILE"
    else
      rm -f "$PID_FILE"
      echo "Backend failed to stay running. Recent log output:" >&2
      tail -n 60 "$LOG_FILE" >&2 || true
      exit 1
    fi
    ;;
  stop)
    if ! pid="$(read_pid)"; then
      rm -f "$PID_FILE"
      echo "Backend is not running."
      exit 0
    fi
    if ! is_app_process "$pid"; then
      rm -f "$PID_FILE"
      echo "PID file is stale or belongs to another process; no process was stopped." >&2
      exit 1
    fi
    kill -TERM "$pid"
    for _ in {1..10}; do
      if ! kill -0 "$pid" 2>/dev/null; then
        rm -f "$PID_FILE"
        echo "Backend stopped."
        exit 0
      fi
      sleep 1
    done
    echo "Backend did not exit after SIGTERM; sending SIGKILL." >&2
    kill -KILL "$pid" 2>/dev/null || true
    rm -f "$PID_FILE"
    ;;
  restart)
    "$0" stop
    exec "$0" start
    ;;
  status)
    if pid="$(read_pid)" && is_app_process "$pid"; then
      echo "Backend is running (PID $pid). Log: $LOG_FILE"
    else
      echo "Backend is not running."
      exit 1
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}" >&2
    exit 2
    ;;
esac
