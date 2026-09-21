import { useEffect, useLayoutEffect } from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ConfigProvider, App } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSettingsStore } from "@/stores/settings";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useI18n } from "@/i18n";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function RootComponent() {
  const darkMode = useSettingsStore((s) => s.darkMode);
  const configProviderProps = useAppTheme();
  const { antdLocale, language } = useI18n();

  useLayoutEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider {...configProviderProps} locale={antdLocale} componentSize="small">
        <App>
          <Outlet />
        </App>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  // 2026-09-12 00:00:00 CST：错误路由统一保持纯白，不显示 404 页面，也不执行额外跳转。
  // 触发场景：访问未注册的路径或错误的 admin/h5 路由；认证守卫产生的登录跳转仍按业务规则执行。
  // 维护注意：错误路由不要在这里增加重定向，避免访客链接或部署探测请求被带到 admin 页面。
  notFoundComponent: () => null,
});
