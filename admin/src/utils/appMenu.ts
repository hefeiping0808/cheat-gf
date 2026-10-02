import type { MenuItem } from "@/api/schemas";

/**
 * Built-in menu tree. Visibility is computed with {@link filterMenuTreeByPermissions}
 * from `GET /api/auth/permissions` (must stay consistent with route permission map below).
 */
export const APP_MENU_TREE: MenuItem[] = [
  {
    id: "g-platform",
    kind: "group",
    name: "平台管理",
    path: null,
    icon: "IconLucideSparkles",
    permissions: null,
    sort: 0,
    hidden: false,
    children: [
      {
        id: "1",
        kind: "item",
        name: "仪表盘",
        path: "/dashboard",
        // 2026-09-29 22:18:20 CST：菜单图标标识需与 Sidebar 的 MENU_ICON_MAP 对应，新增或替换标识时同步维护两处。
        icon: "IconLucideLayoutDashboard",
        children: null,
        permissions: null,
        sort: 0,
        hidden: false,
      },
      {
        id: "2",
        kind: "item",
        name: "用户管理",
        path: "/users",
        icon: "IconLucideUsers",
        children: null,
        permissions: ["user:view"],
        sort: 1,
        hidden: false,
      },
    ],
  },
  {
    id: "3",
    kind: "item",
    name: "黑名单",
    path: "/blacklist",
    icon: "IconLucideBan",
    children: null,
    permissions: null,
    sort: 1,
    hidden: false,
  },
  {
    id: "4",
    kind: "item",
    name: "访客管理",
    path: "/visitors",
    icon: "IconLucideUserList",
    children: null,
    permissions: ["visitor:view"],
    sort: 2,
    hidden: false,
  },
  {
    // 2026-09-13 11:01:25 CST：将操作日志提升为根菜单，确保管理员进入 Admin 后可以直接发现并访问审计记录。
    id: "8",
    kind: "item",
    name: "操作日志",
    path: "/audit-logs",
    icon: "IconLucideAuditBook",
    children: null,
    permissions: ["audit:view"],
    sort: 3,
    hidden: false,
  },
  {
    // 2026-09-10 10:38:07 CST：系统管理改为可展开的顶级菜单，避免配置项与黑名单、访客管理混在同一分组中。
    id: "g-system",
    kind: "item",
    name: "系统管理",
    path: null,
    icon: "IconLucideGear",
    children: [
      {
        id: "5",
        kind: "item",
        name: "字段映射",
        path: "/mappings",
        icon: "IconLucideBookOpen",
        children: null,
        permissions: ["mapping:view"],
        sort: 0,
        hidden: false,
      },
      {
        id: "6",
        kind: "item",
        name: "模板管理",
        path: "/templates",
        icon: "IconLucideSettings",
        children: null,
        permissions: ["template:view"],
        sort: 1,
        hidden: false,
      },
      {
        id: "7",
        kind: "item",
        name: "数据字典",
        path: "/dictionary",
        icon: "IconLucideBookOpen",
        children: null,
        permissions: ["dictionary:view"],
        sort: 2,
        hidden: false,
      },
    ],
    permissions: null,
    sort: 4,
    hidden: false,
  },
];

function hasRequiredPermissions(
  required: string[] | null | undefined,
  granted: Set<string>,
): boolean {
  if (!required || required.length === 0) return true;
  return required.every((p) => granted.has(p));
}

export function filterMenuTreeByPermissions(
  nodes: MenuItem[],
  permissionList: string[],
): MenuItem[] {
  const granted = new Set(permissionList);

  const walk = (list: MenuItem[]): MenuItem[] =>
    list
      .map((node) => {
        if (!hasRequiredPermissions(node.permissions ?? null, granted)) return null;

        if (node.kind === "group") {
          const children = walk(node.children);
          if (children.length === 0) return null;
          return { ...node, children };
        }

        if (node.children?.length) {
          const children = walk(node.children);
          if (children.length === 0) return null;
          return { ...node, children };
        }

        return node;
      })
      .filter((n): n is MenuItem => n != null);

  return walk(nodes);
}

/** Normalized pathname (no trailing slash except `/`) */
export function normalizeAppPath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/admin") return "/";
  return normalized.startsWith("/admin/") ? normalized.slice("/admin".length) : normalized;
}

/**
 * Route → permission required to open the page. `null` = no permission gate.
 * Keep in sync with {@link APP_MENU_TREE} paths.
 */
export function requiredPermissionForPath(pathname: string): string | null {
  const p = normalizeAppPath(pathname);
  const map: Record<string, string | null> = {
    "/dashboard": null,
    "/users": "user:view",
    "/blacklist": "blacklist:view",
    "/visitors": "visitor:view",
    "/mappings": "mapping:view",
    "/dictionary": "dictionary:view",
    "/templates": "template:view",
    "/audit-logs": "audit:view",
    "/403": null,
  };
  return map[p] ?? null;
}

export function canAccessPath(pathname: string, permissions: string[] | undefined): boolean {
  const required = requiredPermissionForPath(pathname);
  if (required == null) return true;
  if (!permissions?.length) return false;
  return permissions.includes(required);
}
