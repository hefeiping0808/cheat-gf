import { useEffect, useLayoutEffect } from "react";
import { createRootRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { ConfigProvider, App } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSettingsStore } from "@/stores/settings";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useI18n } from "@/i18n";
import { useAuthStore } from "@/stores/auth";
import {
  ADMIN_AUTH_EXPIRED_EVENT,
  consumeAdminSessionExpiredNotice,
  expireAdminSession,
  getAdminTokenExpiry,
} from "@/utils/authSession";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function RootComponent() {
  const location = useLocation();
  const darkMode = useSettingsStore((s) => s.darkMode);
  const configProviderProps = useAppTheme();
  const { antdLocale, language } = useI18n();

  useLayoutEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    // 2026-10-04 21:04:33 CST：按顶层路由统一设置浏览器标题，SPA 页面切换时也能恢复对应端的标题。
    // 触发场景：访问任意 Admin 页面或 H5 入口；H5 子页面由 H5Page 内部切换但统一显示“首页”。
    // 维护注意：新增顶层端路由时需在这里补充对应标题，避免沿用上一个页面的标题。
    document.title = location.pathname.startsWith("/h5") ? "首页" : "管理后台";
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider {...configProviderProps} locale={antdLocale} componentSize="small">
        <App>
          <AuthExpiryHandler />
          <Outlet />
        </App>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

function AuthExpiryHandler() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { t } = useI18n();
  const accessToken = useAuthStore((state) => state.tokens?.accessToken);

  useEffect(() => {
    const onSessionExpired = () => {
      consumeAdminSessionExpiredNotice();
      queryClient.clear();
      message.warning(t("auth.sessionExpired"));
      void navigate({ to: "/admin/login", replace: true });
    };
    window.addEventListener(ADMIN_AUTH_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(ADMIN_AUTH_EXPIRED_EVENT, onSessionExpired);
  }, [message, navigate, t]);

  useEffect(() => {
    if (!accessToken) return;
    const expiresAt = getAdminTokenExpiry(accessToken);
    const timeout = expiresAt === null ? 0 : Math.max(0, expiresAt - Date.now());
    const timer = window.setTimeout(() => expireAdminSession(), timeout);
    return () => window.clearTimeout(timer);
  }, [accessToken]);

  return null;
}

export const Route = createRootRoute({
  component: RootComponent,
  // 2026-09-12 00:00:00 CST：错误路由统一保持纯白，不显示 404 页面，也不执行额外跳转。
  // 触发场景：访问未注册的路径或错误的 admin/h5 路由；认证守卫产生的登录跳转仍按业务规则执行。
  // 维护注意：错误路由不要在这里增加重定向，避免访客链接或部署探测请求被带到 admin 页面。
  notFoundComponent: () => null,
});
