import { httpClient } from "@/utils/http";
import { AUTH_ENDPOINTS } from "@/api/auth";
import { AuthUserResponseSchema, PermissionsListSchema, UserSchema } from "@/api/schemas";
import { APP_MENU_TREE, filterMenuTreeByPermissions } from "@/utils/appMenu";
import { useAuthStore } from "@/stores/auth";

/** Fetches `/api/auth/user` and `/api/auth/permissions`, then updates `user` and sidebar `menus`. */
export async function fetchSessionAndApplyToStore(): Promise<void> {
  const [userBase, permissions] = await Promise.all([
    httpClient.get(AUTH_ENDPOINTS.user).then((d) => AuthUserResponseSchema.parse(d)),
    httpClient.get(AUTH_ENDPOINTS.permissions).then((d) => PermissionsListSchema.parse(d)),
  ]);
  const user = UserSchema.parse({ ...userBase, permissions });
  const menus = filterMenuTreeByPermissions(APP_MENU_TREE, permissions);
  const { setUser, setMenus } = useAuthStore.getState();
  setUser(user);
  setMenus(menus);
}
