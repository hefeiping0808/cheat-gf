import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function loginAsAdmin(page: Page) {
  // 2026-09-12 00:00:00 CST：端到端测试同步统一后的 admin 路由前缀，避免测试误访问已移除的旧入口。
  await page.goto("/admin/login");
  await page.getByLabel(/Username|用户名/).fill("admin");
  await page.getByLabel(/Password|密码/).fill("admin");
  await page.getByRole("button", { name: /Sign In|登录/ }).click();
  await expect(page).toHaveURL(/dashboard/);
}

export async function gotoUsers(page: Page) {
  await loginAsAdmin(page);
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/users/);
}
