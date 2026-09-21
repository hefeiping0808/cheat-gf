import { createFileRoute } from "@tanstack/react-router";
import { Button, Card, DatePicker, Select, Space, Table, Tag } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { businessApi, type AuditLogFilters, type AuditLogRow } from "@/api/business";
import { useI18n } from "@/i18n";
import { createTablePagination } from "@/utils/tablePagination";

export const Route = createFileRoute("/admin/_auth/audit-logs/")({ component: AuditLogsPage });

// 2026-09-13 10:55:46 CST：筛选项使用稳定 action key，展示文案交给当前语言词典；后端新增动作时页面仍会回退显示原始 key。
// 触发场景：管理员查看不同语言下的审计记录；维护时新增审计动作应同步加入列表和翻译。
const AUDIT_ACTIONS = [
  "auth.login", "auth.password.change", "auth.logout", "users.create", "users.update", "users.delete", "users.batch",
  "blacklist.create", "blacklist.delete", "blacklist.batch", "mappings.create", "mappings.update", "mappings.delete", "mappings.batch",
  "dictionary.update", "dictionary.batch", "templates.update", "templates.batch", "visitor_links.create", "visitors.delete", "visitors.batch", "visitors.export",
];

function AuditLogsPage() {
  const { t } = useI18n();
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [draftFilters, setDraftFilters] = useState<AuditLogFilters>({});
  const [rangeKey, setRangeKey] = useState(0);
  const operatorsQuery = useQuery({ queryKey: ["audit-log-operators"], queryFn: businessApi.auditOperators });
  const query = useQuery({ queryKey: ["audit-logs", pagination.page, pagination.pageSize, filters], queryFn: () => businessApi.auditLogs(pagination.page, pagination.pageSize, filters) });
  const operators = operatorsQuery.data ?? [];
  const targetTypeLabel = (type: string) => t(`audit.${type}`, undefined, type);
  const actionLabel = (action: string) => t(`audit.action.${action}`, undefined, action);
  // 2026-09-13 10:55:46 CST：筛选条件提交后强制回到第一页，避免旧页码在窄筛选结果下显示空表。
  const applyFilters = () => { setPagination((current) => ({ ...current, page: 1 })); setFilters({ ...draftFilters }); };
  const resetFilters = () => { setDraftFilters({}); setFilters({}); setRangeKey((value) => value + 1); setPagination((current) => ({ ...current, page: 1 })); };

  return (
    <Card title={t("audit.title")}>
      <Space wrap style={{ marginBottom: 16 }}>
        <Select allowClear showSearch optionFilterProp="label" loading={operatorsQuery.isLoading} value={draftFilters.operatorId} placeholder={t("audit.allOperators")} style={{ minWidth: 180 }} options={operators.map((item) => ({ label: item.username, value: item.id }))} onChange={(value) => setDraftFilters((current) => ({ ...current, operatorId: value }))} />
        <Select allowClear showSearch optionFilterProp="label" value={draftFilters.action} placeholder={t("audit.allActions")} style={{ minWidth: 210 }} options={AUDIT_ACTIONS.map((action) => ({ label: actionLabel(action), value: action }))} onChange={(value) => setDraftFilters((current) => ({ ...current, action: value }))} />
        <Select allowClear value={draftFilters.success} placeholder={t("audit.allResults")} style={{ minWidth: 140 }} options={[{ label: t("audit.success"), value: "success" }, { label: t("audit.failed"), value: "failed" }]} onChange={(value) => setDraftFilters((current) => ({ ...current, success: value }))} />
        <DatePicker.RangePicker key={rangeKey} showTime format="YYYY-MM-DD HH:mm:ss" placeholder={[t("audit.startAt"), t("audit.endAt")]} onChange={(dates) => setDraftFilters((current) => ({ ...current, startAt: dates?.[0]?.format("YYYY-MM-DD HH:mm:ss"), endAt: dates?.[1]?.format("YYYY-MM-DD HH:mm:ss") }))} />
        <Button type="primary" onClick={applyFilters}>{t("audit.filter")}</Button>
        <Button onClick={resetFilters}>{t("audit.reset")}</Button>
      </Space>
      <Table
        rowKey="id"
        loading={query.isLoading}
        dataSource={query.data?.list ?? []}
        pagination={createTablePagination(pagination.page, pagination.pageSize, query.data?.total ?? 0, (page, pageSize) => setPagination({ page, pageSize }))}
        scroll={{ x: 1100 }}
        columns={[
          { title: t("audit.operator"), dataIndex: "operator_name" },
          { title: t("audit.action"), dataIndex: "action", render: (value: string) => actionLabel(value) },
          { title: t("audit.targetType"), dataIndex: "target_type", render: (value: string) => targetTypeLabel(value) },
          { title: t("audit.target"), render: (_: unknown, row: AuditLogRow) => row.target_ref || row.target_ids },
          { title: t("audit.targetUser"), dataIndex: "target_user_id", render: (value?: number) => operators.find((item) => Number(item.id) === value)?.username ?? "-" },
          { title: t("audit.ip"), dataIndex: "request_ip" },
          { title: t("audit.result"), dataIndex: "success", render: (value: boolean) => <Tag color={value ? "green" : "red"}>{value ? t("audit.success") : t("audit.failed")}</Tag> },
          { title: t("audit.error"), dataIndex: "error_message", render: (value?: string) => value || "-" },
          { title: t("audit.createdAt"), dataIndex: "created_at" },
        ]}
      />
    </Card>
  );
}
