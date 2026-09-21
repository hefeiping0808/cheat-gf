import { Avatar, Button, Dropdown, Flex, Form, Input, Modal, Typography, App, theme } from "antd";
import type { MenuProps } from "antd";
import { useMutation } from "@tanstack/react-query";
import type { User } from "@/api/schemas";
import { AUTH_ENDPOINTS } from "@/api/auth";
import { httpClient } from "@/utils/http";
import { useI18n } from "@/i18n";
import { MoreVertical } from "lucide-react";
import { useState } from "react";
import "./index.css";

const { Text } = Typography;

interface UserMenuProps {
  collapsed: boolean;
  user: User | null;
  userMenuItems: MenuProps["items"];
}

export function UserMenu({ collapsed, user, userMenuItems }: UserMenuProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { language, setLanguage, t, errorMessage } = useI18n();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm] = Form.useForm<ChangePasswordForm>();

  const passwordMutation = useMutation({
    mutationFn: (values: ChangePasswordForm) =>
      httpClient.post(AUTH_ENDPOINTS.changePassword, {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      message.success(t("user.passwordChanged"));
      setPasswordOpen(false);
      passwordForm.resetFields();
    },
    onError: (error) => message.error(errorMessage(error, "user.passwordChangeFailed")),
  });

  const avatarSrc = (user?.avatar ?? "").trim() || undefined;
  const avatarSize = collapsed ? 32 : token.controlHeight;

  const avatar = (
    <Avatar
      size={avatarSize}
      src={avatarSrc || undefined}
      shape="circle"
      style={{
        flexShrink: 0,
        width: avatarSize,
      }}
    >
      {user?.username?.[0]?.toUpperCase()}
    </Avatar>
  );

  const moreButton = (
    <Button type="text" size="small" icon={<MoreVertical size={token.fontSize} />} />
  );

  const menuItems: MenuProps["items"] = [
    {
      key: "change-password",
      label: t("user.changePassword"),
      onClick: () => setPasswordOpen(true),
    },
    {
      key: "language",
      label: t("language.switch"),
      children: [
        {
          key: "zh-CN",
          label: t("language.zhCN"),
          disabled: language === "zh-CN",
          onClick: () => setLanguage("zh-CN"),
        },
        {
          key: "en-US",
          label: t("language.enUS"),
          disabled: language === "en-US",
          onClick: () => setLanguage("en-US"),
        },
      ],
    },
    { type: "divider" },
    ...(userMenuItems ?? []),
  ];

  return (
    <>
      <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
      <div
        style={{
          margin: token.marginXS,
        }}
      >
        <Flex
          className="user-menu-trigger"
          align="center"
          justify="flex-start"
          gap={token.marginSM}
          style={{
            width: "100%",
            cursor: "pointer",
            borderRadius: token.borderRadius,
            padding: token.paddingXS,
            ["--user-menu-hover-bg" as string]: token.colorFillTertiary,
          }}
        >
          {avatar}
          {!collapsed ? (
            <>
              <Flex
                vertical
                justify="center"
                gap={2}
                style={{
                  flex: "1 1 0%",
                  minWidth: 0,
                  maxWidth: "100%",
                  overflow: "hidden",
                }}
              >
                <Text
                  ellipsis
                  style={{
                    lineHeight: 1,
                    display: "block",
                    maxWidth: "100%",
                  }}
                >
                  {user?.username ?? "—"}
                </Text>
                <Text
                  ellipsis
                  style={{
                    lineHeight: 1,
                    display: "block",
                    maxWidth: "100%",
                    fontSize: token.fontSizeSM,
                    color: token.colorTextQuaternary,
                  }}
                >
                  {user?.email ?? "—"}
                </Text>
              </Flex>
              {moreButton}
            </>
          ) : null}
        </Flex>
      </div>
      </Dropdown>
      <Modal
        centered
        open={passwordOpen}
        title={t("user.changePassword")}
        okText={t("common.confirm")}
        cancelText={t("common.cancel")}
        confirmLoading={passwordMutation.isPending}
        onCancel={() => setPasswordOpen(false)}
        onOk={() => passwordForm.submit()}
      >
        <Form form={passwordForm} layout="vertical" onFinish={(values) => passwordMutation.mutate(values)}>
          <Form.Item
            name="currentPassword"
            label={t("user.currentPassword")}
            rules={[{ required: true, message: t("user.passwordRequired") }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label={t("user.newPassword")}
            rules={[
              { required: true, message: t("user.passwordRequired") },
              { min: 6, message: t("user.newPasswordMin") },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={t("user.confirmPassword")}
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: t("user.passwordRequired") },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue("newPassword") === value
                    ? Promise.resolve()
                    : Promise.reject(new Error(t("user.passwordMismatch")));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

type ChangePasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};
