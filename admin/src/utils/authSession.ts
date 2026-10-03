import { useAuthStore } from "@/stores/auth";

export const ADMIN_AUTH_EXPIRED_EVENT = "admin:auth-expired";
const AUTH_EXPIRED_NOTICE_KEY = "admin-auth-expired-notice";

// 2026-10-03 00:53:15 CST：前端从 Admin JWT 的 exp 声明计算有效期，使路由守卫和页面运行期定时器使用同一判断。
// 触发场景：登录态恢复、路由切换或 JWT 到期；解码失败按无效 token 处理，避免损坏的持久化 token 放行受保护页面。
export function getAdminTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="))) as {
      exp?: unknown;
    };
    return typeof claims.exp === "number" && Number.isFinite(claims.exp) ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isAdminTokenExpired(token: string): boolean {
  const expiresAt = getAdminTokenExpiry(token);
  return expiresAt === null || expiresAt <= Date.now();
}

export function markAdminSessionExpired(): void {
  try {
    window.sessionStorage.setItem(AUTH_EXPIRED_NOTICE_KEY, "1");
  } catch {
    // 本地存储不可用时仍清理认证状态并执行路由跳转。
  }
}

export function consumeAdminSessionExpiredNotice(): boolean {
  try {
    const shouldShow = window.sessionStorage.getItem(AUTH_EXPIRED_NOTICE_KEY) === "1";
    window.sessionStorage.removeItem(AUTH_EXPIRED_NOTICE_KEY);
    return shouldShow;
  } catch {
    return false;
  }
}

// 2026-10-03 00:53:15 CST：统一结束已失效的 Admin 会话并通知运行中的界面跳转。
// 触发场景：受保护 API 返回 401 或 JWT 到期定时器触发；登录 API 的凭据错误不得调用此函数。
export function expireAdminSession(): void {
  const { isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated) return;
  useAuthStore.getState().logout();
  markAdminSessionExpired();
  window.dispatchEvent(new Event(ADMIN_AUTH_EXPIRED_EVENT));
}
