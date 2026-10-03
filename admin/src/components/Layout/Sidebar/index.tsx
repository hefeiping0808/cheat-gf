import { Menu, Layout, theme, Flex, Grid, Drawer, Button } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import {
  Ban,
  Book,
  BookOpen,
  Briefcase,
  CircleDashed,
  Folder,
  History,
  LayoutDashboard,
  PanelLeft,
  Settings,
  SlidersHorizontal,
  Star,
  User,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { APP_BRAND_NAME } from "@/utils/constants";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import type { MenuItem as MenuItemType } from "@/api/schemas";
import type { MenuProps } from "antd";
import { UserMenu } from "../UserMenu";
import { useI18n } from "@/i18n";
import "./index.css";

const { Sider } = Layout;
/** API menu `name` → translation keys for known keys; unknown keys pass through as `menu.name`. */
const MENU_LABELS: Record<string, string> = {
  平台管理: "menu.platform",
  系统管理: "menu.system",
  仪表盘: "menu.dashboard",
  用户管理: "menu.users",
  黑名单: "menu.blacklist",
  访客管理: "menu.visitors",
  字段映射: "menu.mappings",
  数据字典: "menu.dictionary",
  模板管理: "menu.templates",
  操作日志: "menu.auditLogs",
};

type AntMenuItem = Required<MenuProps>["items"][number];
type BuildMenuResult = {
  items: AntMenuItem[];
  keyToPath: Record<string, string>;
  pathToKeyChain: Record<string, string[]>;
};

const MENU_ICON_MAP: Record<string, LucideIcon> = {
  // 2026-09-29 22:18:20 CST：系统菜单图标由 API 标识映射到 Lucide 组件；修改菜单标识时需同步更新此表。
  IconLucideLayoutDashboard: LayoutDashboard,
  IconLucideUsers: User,
  IconLucideUserList: Users,
  IconLucideHistory: History,
  IconLucideStar: Star,
  IconLucideSettings: SlidersHorizontal,
  IconLucideGear: Settings,
  IconLucideBriefcase: Briefcase,
  IconLucideBookOpen: Book,
  IconLucideAuditBook: BookOpen,
  IconLucideBan: Ban,
  IconLucideFolderKanban: Folder,
  IconLucideSparkles: Zap,
  IconLucideShield: SlidersHorizontal,
};

function renderMenuIcon(icon: string | null, size = 16) {
  const Icon = (icon && MENU_ICON_MAP[icon]) || CircleDashed;
  return <Icon size={size} />;
}

function buildMenuItems(
  menus: MenuItemType[],
  token: ReturnType<typeof theme.useToken>["token"],
  t: (key: string) => string,
  collapsed = false,
  iconSize = 16,
  parentKeys: string[] = [],
): BuildMenuResult {
  const sorted = menus.filter((m) => !m.hidden).sort((a, b) => a.sort - b.sort);
  const keyToPath: Record<string, string> = {};
  const pathToKeyChain: Record<string, string[]> = {};
  const items: AntMenuItem[] = [];

  for (const menu of sorted) {
    const label = t(MENU_LABELS[menu.name] ?? menu.name);
    const key = menu.id;

    if (menu.kind === "group") {
      const built = buildMenuItems(menu.children, token, t, collapsed, iconSize, parentKeys);
      Object.assign(keyToPath, built.keyToPath);
      Object.assign(pathToKeyChain, built.pathToKeyChain);
      if (built.items.length > 0) {
        items.push({
          type: "group",
          key,
          label: collapsed ? (
            <span
              style={{
                width: "100%",
                display: "inline-flex",
                justifyContent: "center",
              }}
            >
              <span
                aria-label={String(label)}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: token.colorTextQuaternary,
                  display: "inline-block",
                }}
              />
            </span>
          ) : (
            <span
              style={{
                fontSize: token.fontSizeSM,
                color: token.colorTextQuaternary,
              }}
            >
              {label}
            </span>
          ),
          children: built.items,
        });
      }
      continue;
    }

    const nextParents = [...parentKeys, key];
    if (menu.path) {
      const routePath = `/admin${menu.path}`;
      keyToPath[key] = routePath;
      const existing = pathToKeyChain[routePath];
      if (!existing || nextParents.length > existing.length) {
        pathToKeyChain[routePath] = nextParents;
      }
    }

    let children: AntMenuItem[] | undefined;
    if (menu.children?.length) {
      const built = buildMenuItems(menu.children, token, t, collapsed, iconSize, nextParents);
      Object.assign(keyToPath, built.keyToPath);
      Object.assign(pathToKeyChain, built.pathToKeyChain);
      children = built.items.length ? built.items : undefined;
    }

    items.push({
      key,
      label,
      icon: renderMenuIcon(menu.icon, iconSize),
      children,
    });
  }

  return { items, keyToPath, pathToKeyChain };
}

export function Sidebar() {
  const menus = useAuthStore((s) => s.menus);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const collapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useSettingsStore((s) => s.setSidebarCollapsed);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const { t } = useI18n();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const mobileOpen = collapsed;
  const builtMenu = useMemo(
    () => buildMenuItems(menus, token, t, !isMobile && collapsed, token.size),
    [menus, token, t, isMobile, collapsed, token.size],
  );
  const { selectedKey, routeOpenKeys } = useMemo(() => {
    const chain = builtMenu.pathToKeyChain[location.pathname] ?? [];
    return { selectedKey: chain.at(-1), routeOpenKeys: chain.slice(0, -1) };
  }, [builtMenu, location.pathname]);
  const routeOpenKeysSig = routeOpenKeys.join("\0");
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(false);
    }
  }, [isMobile, setSidebarCollapsed]);

  /** Merge open keys required by the route with any submenu the user already expanded. */
  useEffect(() => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      for (const k of routeOpenKeys) next.add(k);
      return [...next];
    });
  }, [location.pathname, routeOpenKeysSig]);

  const userMenuItems: MenuProps["items"] = [
    {
      key: "logout",
      label: t("user.signOut"),
      onClick: () => {
        if (isMobile) {
          setSidebarCollapsed(false);
        }
        logout();
        void navigate({ to: "/admin/login" });
      },
    },
  ];

  const sidebarContent = (isCollapsed: boolean, omitBrandToggle = false) => (
    <Flex
      vertical
      style={{
        height: "100%",
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <Flex
        vertical
        justify="center"
        align={isCollapsed ? "center" : "stretch"}
        style={{
          paddingBlock: token.paddingSM,
          /* Collapsed rail is 64px: keep horizontal padding minimal so 40px brand / icons are not clipped by Sider overflow. */
          paddingInline: isCollapsed ? token.paddingXXS : token.paddingSM,
          minHeight: 64,
          flexShrink: 0,
          width: "100%",
          minWidth: 0,
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        <Flex
          align="center"
          gap={token.marginSM}
          style={{
            width: "100%",
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box",
            /* Collapsed: outer row already has paddingSM; extra inline padding would clip the 40px brand box. */
            paddingInline: isCollapsed ? 0 : token.paddingXS,
            minHeight: 40,
            justifyContent: isCollapsed ? "center" : "flex-start",
          }}
        >
          {isCollapsed ? (
            <div className="sidebar-collapsed-brand">
              {/* 2026-09-29 22:15:16 CST：收缩态常驻显示侧栏展开按钮，不使用图片图标或悬停切换层。 */}
              <div className="sidebar-collapsed-brand__toggleLayer">
                <Button
                  type="text"
                  size="small"
                  className="sidebar-collapsed-brand__toggle"
                  onClick={toggleSidebar}
                  icon={<PanelLeft size={token.size} />}
                  aria-label={t("layout.toggleSidebar")}
                />
              </div>
            </div>
          ) : (
            <>
              <Flex
                align="center"
                gap={token.marginSM}
                style={{
                  minWidth: 0,
                  flex: 1,
                  overflow: "hidden",
                }}
              >
                {/* <img
                  src={APP_FAVICON_SRC}
                  alt="logo"
                  width={24}
                  height={24}
                  style={{
                    borderRadius: token.borderRadius,
                    display: "block",
                    flexShrink: 0,
                    objectFit: "contain",
                  }}
                /> */}
                <div
                  style={{
                    minWidth: 0,
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: 600,
                    fontSize: token.fontSizeLG,
                    textTransform: "uppercase",
                  }}
                >
                  {APP_BRAND_NAME}
                </div>
              </Flex>
              {!omitBrandToggle ? (
                <Button
                  type="text"
                  size="small"
                  onClick={toggleSidebar}
                  icon={<PanelLeft size={token.size} />}
                  aria-label={t("layout.toggleSidebar")}
                  style={{ flexShrink: 0 }}
                />
              ) : null}
            </>
          )}
        </Flex>
      </Flex>
      <Menu
        className="admin-sidebar-menu"
        mode="inline"
        selectedKeys={selectedKey ? [selectedKey] : []}
        openKeys={openKeys}
        onOpenChange={(keys) => setOpenKeys(keys as string[])}
        items={builtMenu.items}
        getPopupContainer={() => document.body}
        onClick={({ key }) => {
          const path = builtMenu.keyToPath[String(key)];
          if (!path) return;
          if (isMobile) {
            setSidebarCollapsed(false);
          }
          void navigate({ to: path });
        }}
        style={{
          borderRight: "none",
          flex: 1,
          minWidth: 0,
          maxWidth: "100%",
          width: "100%",
          boxSizing: "border-box",
          minHeight: 0,
          overflowX: "hidden",
          overflowY: "auto",
          overscrollBehavior: "contain",
          background: "transparent",
        }}
      />
      <UserMenu collapsed={isCollapsed} user={user} userMenuItems={userMenuItems} />
    </Flex>
  );

  if (isMobile) {
    return (
      <Drawer
        open={mobileOpen}
        placement="left"
        onClose={() => setSidebarCollapsed(false)}
        size={320}
        styles={{
          body: {
            padding: 0,
            background: token.colorBgLayout,
            overflow: "hidden",
            maxWidth: "100%",
            boxSizing: "border-box",
          },
          header: { display: "none" },
          mask: { opacity: 0.5 },
        }}
      >
        {sidebarContent(false, true)}
      </Drawer>
    );
  }

  // 2026-09-29 22:21:19 CST：保留同一个 Sider 实例才能播放 Ant Design 自带的宽度收缩过渡，不要按 collapsed 添加 key 强制重挂载。
  return (
    <Sider
      theme="light"
      collapsible
      collapsed={collapsed}
      trigger={null}
      width={240}
      collapsedWidth={64}
      breakpoint="lg"
      onBreakpoint={(broken) => {
        if (broken) {
          setSidebarCollapsed(false);
        }
      }}
      style={{
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgLayout,
        alignSelf: "stretch",
        height: "100dvh",
        minHeight: 0,
        overflow: "visible",
      }}
    >
      {sidebarContent(collapsed)}
    </Sider>
  );
}
