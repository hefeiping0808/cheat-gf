import { createFileRoute, Outlet } from "@tanstack/react-router";

// 2026-09-12 00:00:00 CST：把管理端统一收敛到 `/admin` 路由下，作为登录页和受保护页面的共同父级。
// 触发场景：访问 `/admin/*`；认证守卫放在下层 pathless route，避免登录页被自身守卫拦截。
// 维护注意：新增管理端页面必须放在 `routes/admin/_auth/` 下，才能自动继承认证和权限检查。
function AdminRoute() {
  return <Outlet />;
}

export const Route = createFileRoute("/admin")({ component: AdminRoute });
