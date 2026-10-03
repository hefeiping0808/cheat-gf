import { Layout, theme, Flex } from "antd";
import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "../Sidebar";
import { Header } from "../Header";
import { AppFooter } from "../AppFooter";

const { Content } = Layout;

export function MainLayout() {
  const { token } = theme.useToken();

  return (
    <Layout style={{ height: "100dvh", minHeight: 0, overflow: "hidden" }}>
      <Sidebar />
      <Flex
        vertical
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          height: "100%",
          overflow: "hidden",
        }}
      >
        <Header />
        <Content
          className="main-layout-main"
          style={{
            // 2026-10-02 17:17:28 CST：用确定的零基准约束内容区高度，确保页面内容超出时由此容器滚动。
            // 触发场景：Admin 页面内容较长或视口较矮；不要移除 height: 0 / minHeight: 0，否则 flex 子项可能反向撑高布局。
            flex: "1 1 0px",
            padding: token.paddingLG,
            height: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflowX: "hidden",
            overflowY: "auto",
            overscrollBehavior: "contain",
          }}
        >
          <Outlet />
        </Content>
        {/* 2026-10-02 10:10:21 CST：主布局挂载全局页脚，使登录后的每个 Admin 页面都能看到当前构建版本。 */}
        <div style={{ padding: `0 ${token.paddingLG}px ${token.paddingSM}px` }}>
          <AppFooter />
        </div>
      </Flex>
    </Layout>
  );
}
