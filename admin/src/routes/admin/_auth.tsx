import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth";
import { MainLayout } from "@/components/Layout/MainLayout";
import { canAccessPath, normalizeAppPath } from "@/utils/appMenu";
import { isAdminTokenExpired, markAdminSessionExpired } from "@/utils/authSession";

export const Route = createFileRoute("/admin/_auth")({
  beforeLoad: ({ location }) => {
    const { isAuthenticated, tokens, user } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: "/admin/login" });
    }

    // 2026-10-03 00:53:15 CST：进入任一受保护路由前检查 JWT 有效期，避免仅凭持久化登录标志放行过期会话。
    // 触发场景：刷新页面或在 Admin 内切换路由；过期时先清理认证状态，再由登录页消费一次性提示。
    if (!tokens?.accessToken || isAdminTokenExpired(tokens.accessToken)) {
      markAdminSessionExpired();
      useAuthStore.getState().logout();
      throw redirect({ to: "/admin/login" });
    }

    const path = normalizeAppPath(location.pathname);
    if (path === "/403") return;

    if (!canAccessPath(location.pathname, user?.permissions)) {
      throw redirect({ to: "/admin/403" });
    }
  },
  component: MainLayout,
});
