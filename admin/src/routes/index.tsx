import { createFileRoute } from "@tanstack/react-router";

// 2026-09-12 00:00:00 CST：根路径视为非业务入口，保持纯白，不再跳转到 admin 登录页。
// 触发场景：用户访问 `/` 或部署健康探测命中根路径；真正的 admin 页面仍从 `/admin/*` 进入。
// 维护注意：不要把根路径改回登录重定向，否则错误入口会泄露 admin 页面行为。
export const Route = createFileRoute("/")({ component: () => null });
