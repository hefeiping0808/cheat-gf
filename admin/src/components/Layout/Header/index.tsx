import { Layout, Button, Space, theme, Breadcrumb, Flex, Divider, Grid } from "antd";
import type { ItemType } from "antd/es/breadcrumb/Breadcrumb";
import { useSettingsStore } from "@/stores/settings";
import { Link, useLocation, useMatches } from "@tanstack/react-router";
import {
  Ban,
  Book,
  BookOpen,
  Home,
  LayoutDashboard,
  PanelLeft,
  ShieldAlert,
  SlidersHorizontal,
  User,
  Users,
  Volume2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Theme } from "@/components/Icon";
import { useI18n } from "@/i18n";
import { playVisitorSound } from "@/utils/visitorSound";
import "./index.css";

const { Header: AntHeader } = Layout;

const PATH_LABEL: Record<string, string> = {
  "/dashboard": "menu.dashboard",
  "/users": "menu.users",
  "/blacklist": "menu.blacklist",
  "/visitors": "menu.visitors",
  "/mappings": "menu.mappings",
  "/dictionary": "menu.dictionary",
  "/templates": "menu.templates",
  "/audit-logs": "menu.auditLogs",
  "/403": "403",
};

// 2026-10-14 07:27:39 CST：让面包屑图标与侧栏路由菜单的图标保持一致。
// 触发场景：进入任意 Admin 页面时显示仪表盘入口和当前页面图标。
// 维护注意：新增或修改侧栏路由图标时需同步更新此表；未知路由继续回退为首页图标。
const PATH_ICON: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/users": User,
  "/blacklist": Ban,
  "/visitors": Users,
  "/mappings": Book,
  "/dictionary": Book,
  "/templates": SlidersHorizontal,
  "/audit-logs": BookOpen,
  "/403": ShieldAlert,
};

function normalizePath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/admin") return "/";
  return normalized.startsWith("/admin/") ? normalized.slice("/admin".length) : normalized;
}

export type HeaderProps = {
  /**
   * When `false`, breadcrumb is hidden; left `Flex` still uses `flex={1}` so header actions stay right-aligned.
   * Routes may also set `staticData: { hideBreadcrumb: true }` (deepest matching route wins).
   */
  showBreadcrumb?: boolean;
};

export function Header({ showBreadcrumb: showBreadcrumbProp = true }: HeaderProps) {
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const toggleDarkMode = useSettingsStore((s) => s.toggleDarkMode);
  const location = useLocation();
  const matches = useMatches();
  const { token } = theme.useToken();
  const { language, setLanguage, t } = useI18n();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;

  const iconSize = token.fontSize;

  const crumb = (Icon: LucideIcon, label: ReactNode, linkTo?: "/admin/dashboard") => {
    const row = (
      <>
        <Icon size={iconSize} aria-hidden style={{ flexShrink: 0, opacity: 0.88 }} />
        <span>{label}</span>
      </>
    );
    const rowStyle = {
      display: "inline-flex" as const,
      alignItems: "center" as const,
      gap: token.marginXS,
      color: "inherit" as const,
    };
    if (linkTo) {
      return (
        <Link to={linkTo} style={rowStyle}>
          {row}
        </Link>
      );
    }
    return <span style={rowStyle}>{row}</span>;
  };

  const path = normalizePath(location.pathname);
  const segments = path.split("/").filter(Boolean);
  const firstSegmentPath = segments.length ? `/${segments[0]}` : "/dashboard";
  const leafLabelKey = PATH_LABEL[firstSegmentPath] ?? "menu.dashboard";

  const leafIcon = PATH_ICON[firstSegmentPath] ?? Home;

  const leafLabel = t(leafLabelKey);
  const enableVisitorSound = async () => {
    const played = await playVisitorSound();
    if (played) return;
    // 2026-09-10 18:50:00 CST：Header 按钮作为浏览器音频权限的用户手势入口，播放失败时只提示文件或权限问题。
    console.debug("[visitor] 提示音播放失败，请检查 admin/public/dingdong.mp3 或浏览器音频权限");
  };

  const breadcrumbItems: ItemType[] = [];

  const onDashboard = path === "/dashboard" || path === "/";

  if (onDashboard) {
    breadcrumbItems.push({
      title: crumb(PATH_ICON["/dashboard"], t("menu.dashboard")),
    });
  } else {
    breadcrumbItems.push({
      title: crumb(PATH_ICON["/dashboard"], t("menu.dashboard"), "/admin/dashboard"),
    });

    breadcrumbItems.push({
      title: crumb(leafIcon, leafLabel),
    });

    if (segments.length > 1) {
      const tail = segments.slice(1).join(" / ");
      if (tail) {
        breadcrumbItems.push({ title: tail });
      }
    }
  }

  const leafStatic = matches.at(-1)?.staticData as { hideBreadcrumb?: boolean } | undefined;
  const hideBreadcrumbFromRoute = leafStatic?.hideBreadcrumb === true;
  const showBreadcrumb =
    showBreadcrumbProp && !hideBreadcrumbFromRoute && breadcrumbItems.length > 0;

  return (
    <AntHeader
      className="admin-header"
      style={{
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        padding: `0 ${token.padding}px`,
        gap: token.sizeLG,
        display: "flex",
      }}
    >
      <Flex align="center" flex={1} style={{ minWidth: 0 }}>
        {isMobile ? (
          <Button
            type="text"
            size="small"
            onClick={toggleSidebar}
            icon={<PanelLeft size={token.size} />}
            aria-label={t("layout.toggleSidebar")}
          />
        ) : null}
        {showBreadcrumb ? (
          <>
            {isMobile ? <Divider vertical /> : null}
            <Breadcrumb items={breadcrumbItems} />
          </>
        ) : null}
      </Flex>
      <Space size="small">
        <Button
          type="text"
          size="small"
          onClick={() => { void enableVisitorSound(); }}
          icon={<Volume2 size={token.size} />}
          aria-label={t("layout.enableVisitorSound")}
          title={t("layout.enableVisitorSound")}
        />
        <Button
          type="text"
          size="small"
          onClick={() => setLanguage(language === "zh-CN" ? "en-US" : "zh-CN")}
          aria-label={t("language.switch")}
        >
          {language === "zh-CN" ? "EN" : "中"}
        </Button>
        <Button
          type="text"
          size="small"
          onClick={toggleDarkMode}
          icon={<Theme size={token.size} />}
          aria-label={t("layout.toggleTheme")}
        />
      </Space>
    </AntHeader>
  );
}
