import { useQuery } from "@tanstack/react-query";
import { Tooltip, Typography } from "antd";
import { businessApi } from "@/api/business";
import { useI18n } from "@/i18n";

const IP_REGION_CACHE_MS = 24 * 60 * 60 * 1000;

type IpRegionDisplayProps = {
  ip?: string | null;
};

// 2026-09-30 02:13:10 CST：归属地仅用于表格展示，查询失败或特殊地址时直接回退显示原始 IP。
export function IpRegionDisplay({ ip }: IpRegionDisplayProps) {
  const { t } = useI18n();
  const rawIP = ip?.trim() ?? "";
  const query = useQuery({
    queryKey: ["ip-region", rawIP],
    queryFn: () => businessApi.ipRegion(rawIP),
    enabled: Boolean(rawIP),
    staleTime: 5 * 60 * 1000,
    gcTime: IP_REGION_CACHE_MS,
    retry: false,
  });

  if (!rawIP) return <Typography.Text type="secondary">-</Typography.Text>;
  const display = query.data?.region || rawIP;
  return (
    <Tooltip title={t("ipRegion.rawIp", { ip: rawIP })}>
      <Typography.Text style={{ cursor: "help" }}>{display}</Typography.Text>
    </Tooltip>
  );
}
