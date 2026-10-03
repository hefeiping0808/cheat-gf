import { Flex, Typography, theme } from "antd";
import { useI18n } from "@/i18n";
import { APP_VERSION } from "@/utils/constants";

export function AppFooter() {
  const { token } = theme.useToken();
  const { t } = useI18n();

  return (
    <Flex
      align="center"
      justify="center"
      wrap
      gap={4}
      style={{
        lineHeight: token.lineHeight,
      }}
    >
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, marginBottom: 0 }}>
        {t("footer.version", { version: APP_VERSION })}
      </Typography.Text>
    </Flex>
  );
}
