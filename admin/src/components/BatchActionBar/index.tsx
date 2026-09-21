import { Button, Popconfirm, Space, Typography } from "antd";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n";

export type BatchAction = {
  key: string;
  label: ReactNode;
  confirmTitle: ReactNode;
  danger?: boolean;
  onConfirm: () => void;
};

type BatchActionBarProps = {
  selectedCount: number;
  actions: BatchAction[];
  clearSelection: () => void;
  compact?: boolean;
};

export function BatchActionBar({ selectedCount, actions, clearSelection, compact = false }: BatchActionBarProps) {
  const { t } = useI18n();
  if (selectedCount === 0) return null;

  // 2026-09-13 10:05:31 CST：统一管理所有 Admin 表格的批量操作入口与二次确认，避免各页面遗漏确认或产生交互差异。
  // 触发场景：用户在任意管理表格勾选一条或多条记录；维护时新增批量动作必须继续提供明确的确认文案。
  return (
    <Space wrap style={{ marginBottom: compact ? 0 : 16 }}>
      <Typography.Text type="secondary">{t("batch.selected", { count: selectedCount })}</Typography.Text>
      {actions.map((action) => (
        <Popconfirm
          key={action.key}
          title={action.confirmTitle}
          okText={t("common.confirm")}
          cancelText={t("common.cancel")}
          onConfirm={action.onConfirm}
        >
          <Button danger={action.danger}>{action.label}</Button>
        </Popconfirm>
      ))}
      <Button type="link" onClick={clearSelection}>{t("batch.clear")}</Button>
    </Space>
  );
}
