import { createFileRoute } from "@tanstack/react-router";
import { Card, Col, Row, Statistic, Table, Tag, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";
import * as echarts from "echarts";
import { useEffect, useMemo, useRef } from "react";
import { businessApi } from "@/api/business";
import type { AuditLogRow } from "@/api/business";
import { useI18n } from "@/i18n";
import "./index.css";

export const Route = createFileRoute("/admin/_auth/dashboard/")({ component: DashboardPage });

// 2026-09-13 11:20:35 CST：固定仪表盘的 10 个 module，访问量为 0 时仍保留卡片，保证管理员可以直观看到完整模块范围。
// 触发场景：仪表盘从分页表格改为模块访问量卡片；维护时新增 module 必须同步扩展这里的固定列表。
const DASHBOARD_MODULES = Array.from({ length: 10 }, (_, index) => `module${index + 1}`);

function localRecentDays(): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - 6 + index);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
}

function DashboardTrendChart({ days, rows, moduleLabels }: { days: string[]; rows: Array<{ day: string; module: string; visits: number }>; moduleLabels: Record<string, string> }) {
  const { t } = useI18n();
  const chartElement = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const option = useMemo<echarts.EChartsOption>(() => {
    const visitCountByKey = new Map(rows.map((row) => [`${row.day}:${row.module}`, row.visits]));
    return {
      animation: false,
      color: ["#1677ff", "#52c41a", "#faad14", "#f5222d", "#722ed1", "#13c2c2", "#eb2f96", "#fa541c", "#2f54eb", "#a0d911"],
      tooltip: { trigger: "axis" },
      legend: { type: "scroll", top: 0, left: 0, right: 0 },
      grid: { top: 48, right: 20, bottom: 32, left: 48, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: days },
      yAxis: { type: "value", minInterval: 1, name: t("dashboard.visitCount") },
      series: DASHBOARD_MODULES.map((module) => ({
        name: moduleLabels[module] || module,
        type: "line" as const,
        smooth: true,
        showSymbol: false,
        data: days.map((day) => visitCountByKey.get(`${day}:${module}`) ?? 0),
      })),
    };
  }, [days, moduleLabels, rows, t]);

  useEffect(() => {
    if (!chartElement.current) return;
    const chart = echarts.init(chartElement.current);
    chartInstance.current = chart;
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(chartElement.current);
    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartInstance.current = null;
    };
  }, []);

  useEffect(() => {
    chartInstance.current?.setOption(option, true);
  }, [option]);

  return <div ref={chartElement} className="dashboard-trend-chart" aria-label={t("dashboard.moduleTrend")} />;
}

function RecentActionsTable({ rows, loading, moduleLabels }: { rows: AuditLogRow[]; loading: boolean; moduleLabels: Record<string, string> }) {
  const { t } = useI18n();
  const actionLabel = (action: string) => t(`audit.action.${action}`, undefined, action);
  return <div className="dashboard-recent-table"><Table rowKey="id" size="small" loading={loading} pagination={false} dataSource={rows} scroll={{ x: 560 }} columns={[{ title: t("audit.createdAt"), dataIndex: "created_at", width: 160 }, { title: t("audit.operator"), dataIndex: "operator_name", width: 100 }, { title: t("audit.action"), dataIndex: "action", width: 150, render: (value: string) => actionLabel(value) }, { title: t("audit.target"), width: 120, render: (_: unknown, row: AuditLogRow) => row.target_type === "template" && row.target_ref ? moduleLabels[row.target_ref] || row.target_ref : row.target_ref || row.target_ids }, { title: t("audit.result"), dataIndex: "success", width: 80, render: (value: boolean) => <Tag color={value ? "green" : "red"}>{value ? t("audit.success") : t("audit.failed")}</Tag> }, { title: t("audit.error"), dataIndex: "error_message", width: 160, render: (value?: string) => value || "-" }]} /></div>;
}

function DashboardPage() {
  const { t } = useI18n();
  const query = useQuery({ queryKey: ["dashboard"], queryFn: () => businessApi.dashboard(1, 10), refetchInterval: 15_000 });
  const data = query.data;
  const visitCountByModule = new Map((data?.moduleVisits.list ?? []).map((item) => [item.module, item.visits]));
  const trendDays = data?.moduleVisitTrend?.days ?? localRecentDays();
  const moduleLabels = data?.moduleLabels ?? {};

  return <div className="dashboard-page"><Typography.Title level={3}>{t("dashboard.title")}</Typography.Title><Row className="dashboard-summary-row" gutter={[16, 16]}><Col xs={24} sm={12} lg={6}><Card><Statistic title={t("dashboard.visitors")} value={data?.visitorCount ?? 0} /></Card></Col><Col xs={24} sm={12} lg={6}><Card><Statistic title={t("dashboard.online")} value={data?.onlineUsers ?? 0} /></Card></Col><Col xs={24} sm={12} lg={6}><Card><Statistic title={t("dashboard.ipCount")} value={data?.ipCount ?? 0} /></Card></Col><Col xs={24} sm={12} lg={6}><Card><Statistic title={t("dashboard.totalVisits")} value={data?.visitTotal ?? 0} /></Card></Col></Row><Card className="dashboard-module-visits-card" title={t("dashboard.templateVisits")} style={{ marginTop: 16 }}><div className="dashboard-module-grid">{DASHBOARD_MODULES.map((module) => <Card key={module} size="small" loading={query.isLoading} className="dashboard-module-card"><Statistic title={moduleLabels[module] || module} value={visitCountByModule.get(module) ?? 0} suffix={t("dashboard.visitCount")} /></Card>)}</div></Card><div className="dashboard-bottom-grid"><Card className="dashboard-bottom-card" title={t("dashboard.moduleTrend")}><DashboardTrendChart days={trendDays} rows={data?.moduleVisitTrend.list ?? []} moduleLabels={moduleLabels} /></Card><Card className="dashboard-bottom-card" title={t("dashboard.recentActions")}><RecentActionsTable rows={data?.recentActions ?? []} loading={query.isLoading} moduleLabels={moduleLabels} /></Card></div></div>;
}
