import type { AuthTokens, LoginRequest, User, MenuItem, PermissionsList } from "./schemas";

export const AUTH_ENDPOINTS = {
  login: "/api/auth/login",
  refresh: "/api/auth/refresh",
  logout: "/api/auth/logout",
  changePassword: "/api/auth/password",
  user: "/api/auth/user",
  permissions: "/api/auth/permissions",
} as const;

export type { AuthTokens, LoginRequest, User, MenuItem, PermissionsList };
