import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Form, Input, Button, Card, App, theme, Typography, Flex, Checkbox, Space } from "antd";
import type { CSSProperties } from "react";
import { useMutation } from "@tanstack/react-query";
import { httpClient } from "@/utils/http";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { AUTH_ENDPOINTS } from "@/api/auth";
import { LoginRequestSchema, AuthTokensSchema } from "@/api/schemas";
import { fetchSessionAndApplyToStore } from "@/utils/session";
import type { LoginRequest } from "@/api/schemas";
import { APP_BRAND_NAME, APP_FAVICON_SRC } from "@/utils/constants";
import { Theme } from "@/components/Icon";
import { AppFooter } from "@/components/Layout/AppFooter";
import { Aurora } from "@/components/Aurora";
import { useI18n } from "@/i18n";
import "./index.css";

export const Route = createFileRoute("/admin/login/")({
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState();
    if (isAuthenticated) {
      throw redirect({ to: "/admin/dashboard" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const setTokens = useAuthStore((s) => s.setTokens);
  const toggleDarkMode = useSettingsStore((s) => s.toggleDarkMode);
  const darkMode = useSettingsStore((s) => s.darkMode);
  const { token } = theme.useToken();
  const { t, errorMessage } = useI18n();

  const loginMutation = useMutation({
    mutationFn: async (values: LoginRequest) => {
      const parsed = LoginRequestSchema.parse(values);
      const tokens = await httpClient.post(AUTH_ENDPOINTS.login, parsed);
      const validTokens = AuthTokensSchema.parse(tokens);
      setTokens(validTokens);
      await fetchSessionAndApplyToStore();
    },
    onSuccess: () => {
      message.success(t("login.success"));
      void navigate({ to: "/admin/dashboard" });
    },
    onError: (err) => {
      message.error(errorMessage(err, "login.failed"));
    },
  });

  const shellStyle: CSSProperties = {
    position: "relative",
    isolation: "isolate",
    minHeight: "100vh",
    backgroundColor: token.colorBgLayout,
    color: token.colorText,
  };

  const contentStyle: CSSProperties = {
    position: "relative",
    zIndex: 1,
    flex: "1 1 0%",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
  };

  const glassMix = darkMode ? "52%" : "42%";
  const backdrop = darkMode ? "blur(22px) saturate(1.2)" : "blur(18px) saturate(1.35)";

  const cardStyle: CSSProperties = {
    width: "100%",
    maxWidth: 384,
    background: `color-mix(in srgb, ${token.colorBgContainer} ${glassMix}, transparent)`,
    backdropFilter: backdrop,
    WebkitBackdropFilter: backdrop,
    borderColor: token.colorBorderSecondary,
    boxShadow: token.boxShadow,
    ["--login-card-fallback-bg" as string]: token.colorBgElevated,
  };

  return (
    <Flex vertical style={shellStyle}>
      <Aurora />
      <Flex vertical style={contentStyle}>
        <Flex
          flex={1}
          align="center"
          justify="center"
          style={{ padding: token.padding, minHeight: 0 }}
        >
          <Card
            className="login-page__card"
            style={cardStyle}
            styles={{
              body: { padding: token.paddingLG, background: "transparent" },
            }}
          >
            <Flex
              align="center"
              justify="center"
              gap={token.margin}
              wrap="wrap"
              style={{ marginBottom: token.marginLG }}
            >
              {/* <img
                src={APP_FAVICON_SRC}
                alt=""
                width={32}
                height={32}
                draggable={false}
                style={{ display: "block", flexShrink: 0 }}
              /> */}
              <Typography.Title
                level={3}
                style={{
                  margin: 0,
                  fontWeight: "bold",
                  letterSpacing: "-0.025em",
                  lineHeight: 1.2,
                  textTransform: "uppercase",
                }}
              >
                {APP_BRAND_NAME}
              </Typography.Title>
            </Flex>

            <Form
              layout="vertical"
              onFinish={(values) => {
                loginMutation.mutate(LoginRequestSchema.parse(values));
              }}
              initialValues={{ username: "admin", password: "admin123", remember: true }}
              requiredMark={false}
            >
              <Form.Item
                name="username"
                label={<span style={{ fontWeight: 500 }}>{t("login.username")}</span>}
                rules={[{ required: true, message: t("users.usernameRequired") }]}
              >
                <Input
                  id="login-username"
                  aria-label={t("login.username")}
                  placeholder="admin"
                  size="small"
                />
              </Form.Item>

              <Form.Item
                name="password"
                label={<span style={{ fontWeight: 500 }}>{t("login.password")}</span>}
                rules={[{ required: true, message: t("user.passwordRequired") }]}
                style={{ marginBottom: token.marginLG }}
              >
                <Input.Password
                  id="login-password"
                  aria-label={t("login.password")}
                  placeholder="admin"
                  size="small"
                />
              </Form.Item>

              <Flex
                justify="space-between"
                align="center"
                style={{ marginBottom: token.marginLG }}
                wrap="wrap"
              >
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox>{t("login.remember")}</Checkbox>
                </Form.Item>
                <Typography.Link
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  style={{ fontSize: token.fontSizeSM }}
                >
                  {t("login.forgotPassword")}
                </Typography.Link>
              </Flex>

              <Form.Item style={{ marginBottom: 0, marginTop: token.marginLG }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loginMutation.isPending}
                  block
                  size="small"
                >
                  {t("login.submit")}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Flex>
        <Flex
          vertical
          align="center"
          style={{
            padding: `${token.paddingSM}px ${token.padding}px`,
            textAlign: "center",
          }}
        >
          <Flex justify="center" style={{ marginBottom: token.marginSM }}>
            <Space size="small">
              <Button
                type="text"
                size="small"
                onClick={toggleDarkMode}
                icon={<Theme size={token.size} />}
                aria-label={t("layout.toggleTheme")}
              />
            </Space>
          </Flex>
          <AppFooter />
        </Flex>
      </Flex>
    </Flex>
  );
}
