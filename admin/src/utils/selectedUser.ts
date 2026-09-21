export const SELECTED_USER_STORAGE_KEY = "admin-selected-user-id";

// 2026-09-10 11:38:06 CST：黑名单和访客页面共用管理员当前查询用户，刷新或切换页面后继续使用；退出登录时由认证 store 清除。
export function getSelectedUserId(): string | undefined {
  const value = localStorage.getItem(SELECTED_USER_STORAGE_KEY)?.trim();
  return value || undefined;
}

export function setSelectedUserId(userId: string | undefined): void {
  if (userId) {
    localStorage.setItem(SELECTED_USER_STORAGE_KEY, userId);
  } else {
    localStorage.removeItem(SELECTED_USER_STORAGE_KEY);
  }
}

export function clearSelectedUserId(): void {
  localStorage.removeItem(SELECTED_USER_STORAGE_KEY);
}
