import { createFileRoute } from "@tanstack/react-router";
import { App, Button, Card, Checkbox, Modal, Popconfirm, Select, Space, Table, Typography } from "antd";
import { useEffect, useMemo, useRef, useState, type Key } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { businessApi, type VisitorRow } from "@/api/business";
import { getAuthHeaders, httpClient } from "@/utils/http";
import { useI18n } from "@/i18n";
import { useAuthStore } from "@/stores/auth";
import { getSelectedUserId, setSelectedUserId } from "@/utils/selectedUser";
import { API_BASE_URL, APP_BASE_URL } from "@/utils/constants";
import { connectRealtime, type RealtimeConnection } from "@/utils/realtime";
import { playVisitorSound } from "@/utils/visitorSound";
import { createTablePagination } from "@/utils/tablePagination";
import { BatchActionBar } from "@/components/BatchActionBar";

export const Route = createFileRoute("/admin/_auth/visitors/")({ component: VisitorsPage });

const MODULE_KEYS = Array.from({ length: 20 }, (_, index) => `key${index + 1}`);
const ITEM_COLUMN_KEYS = Array.from({ length: 20 }, (_, index) => `item${index + 1}`);
const VISITOR_COLUMNS_STORAGE_KEY = "admin-visitors-visible-item-columns";

function getInitialVisibleItemColumns() {
  const defaultColumns = ITEM_COLUMN_KEYS.slice(0, 10);
  try {
    const saved = JSON.parse(localStorage.getItem(VISITOR_COLUMNS_STORAGE_KEY) ?? "null");
    if (!Array.isArray(saved)) return defaultColumns;
    const columns = saved.filter((item): item is string => typeof item === "string" && ITEM_COLUMN_KEYS.includes(item));
    return columns.length > 0 ? columns : defaultColumns;
  } catch {
    return defaultColumns;
  }
}

function VisitorsPage() {
  const { message, modal } = App.useApp();
  const { t, errorMessage } = useI18n();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";
  const [selectedUserId, setSelectedUser] = useState<string | undefined>(() => getSelectedUserId());
  const [links, setLinks] = useState<Array<{ module: string; path: string }>>([]);
  const [operationVisitor, setOperationVisitor] = useState<VisitorRow | null>(null);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const knownVisitorIdsRef = useRef<Set<number>>(new Set());
  // 2026-09-10 18:05:00 CST：记录访客表格当前选择的 item 列，默认显示 item1~item10。
  const [visibleItemColumns, setVisibleItemColumns] = useState<string[]>(getInitialVisibleItemColumns);
  const [draftVisibleItemColumns, setDraftVisibleItemColumns] = useState<string[]>(getInitialVisibleItemColumns);
  const realtimeRef = useRef<RealtimeConnection | null>(null);
  const client = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["user-options"], queryFn: businessApi.userOptions, enabled: isAdmin });
  const templatesQuery = useQuery({ queryKey: ["templates", "visitor-options"], queryFn: () => businessApi.templates(1, 100) });
  const dictionaryQuery = useQuery({ queryKey: ["dictionary", "visitor-options"], queryFn: () => businessApi.dictionary(1, 40) });
  const dictionaryNames = useMemo(() => Object.fromEntries((dictionaryQuery.data?.list ?? []).map((item) => [item.key, item.label?.trim() || item.key])), [dictionaryQuery.data]);
  // 2026-09-13 11:38:08 CST：访客表格沿用模板管理返回的 module label 映射，未配置时回退原 module 标识。
  // 触发场景：管理员为 module 配置展示名称后重新进入访客管理；维护时保留 module 作为查询和链接参数，不要替换数据主键。
  const moduleLabels = useMemo(() => Object.fromEntries((templatesQuery.data?.list ?? []).map((item) => [item.module, item.label?.trim() || item.module])), [templatesQuery.data]);
  const availableUsers = (usersQuery.data ?? []).filter((item) => item.role !== "admin");
  const selectedUserIsValid = !isAdmin || (usersQuery.isSuccess && Boolean(selectedUserId) && availableUsers.some((item) => item.id === selectedUserId));
  const query = useQuery({ queryKey: ["visitors", selectedUserId, pagination.page, pagination.pageSize], queryFn: () => businessApi.visitors(pagination.page, pagination.pageSize, selectedUserId), enabled: selectedUserIsValid });
  useEffect(() => {
    // 2026-09-10 20:16:48 CST：切换管理员筛选用户后回到第一页，避免新用户数据少于旧页码时显示空表。
    setPagination((current) => current.page === 1 ? current : { ...current, page: 1 });
  }, [selectedUserId]);
  useEffect(() => {
    if (!isAdmin || !usersQuery.isSuccess || !selectedUserId || availableUsers.some((item) => item.id === selectedUserId)) return;
    // 2026-09-10 11:38:06 CST：本地用户已删除或不再是普通用户时，清除旧选择并重新拉取用户列表，要求管理员重新选择。
    setSelectedUser(undefined);
    setSelectedUserId(undefined);
    void usersQuery.refetch();
  }, [availableUsers, isAdmin, selectedUserId, usersQuery.isSuccess, usersQuery.refetch]);
  useEffect(() => {
    if (!query.isSuccess) return;
    // 2026-09-10 18:50:00 CST：HTTP 首次加载只建立已知访客快照，不播放声音，避免把请求结果误判为新访客。
    knownVisitorIdsRef.current = new Set((query.data?.list ?? []).map((row) => row.id));
  }, [query.data, query.isSuccess]);
  useEffect(() => {
    const raw = localStorage.getItem("auth-storage");
    const token = raw ? JSON.parse(raw)?.state?.tokens?.accessToken : "";
    if (!token || !user || !["admin", "user"].includes(user.role) || !query.isSuccess) return;
    const apiBase = new URL(API_BASE_URL || window.location.origin);
    const protocol = apiBase.protocol === "https:" ? "wss:" : "ws:";
    const realtimeRole = user.role === "admin" ? "2" : "1";
    // 2026-09-10 13:16:05 CST：Admin 按登录角色携带 WS 连接类型，后端据此绑定全局或用户级订阅。
    // 触发场景：管理员和普通用户共用访客管理页面，但两者可接收的数据范围不同。
    // 维护注意：r 只是连接类型标识，最终权限仍由后端校验 JWT 的 role 与订阅范围。
    const realtime = connectRealtime({
      url: `${protocol}//${apiBase.host}/api/ws?r=${realtimeRole}&token=${encodeURIComponent(token)}`,
      onMessage: (event) => {
        try {
          const body = JSON.parse(event.data) as { type?: string; ok?: boolean; reason?: string; module?: string; key?: string; visitorId?: number; userId?: number };
          if (body.type === "visitor.updated") {
            const inSelectedUser = !selectedUserId || String(body.userId) === selectedUserId;
            const isNewVisitor = body.visitorId != null && !knownVisitorIdsRef.current.has(body.visitorId);
            if (isNewVisitor && inSelectedUser) {
              void playVisitorSound().then((played) => {
                if (played) return;
                // 2026-09-10 18:50:00 CST：浏览器禁止无用户手势播放时弹出一次引导，用户可通过 Header 右上角按钮完成解锁。
                modal.warning({
                  title: t("visitors.soundBlockedTitle"),
                  content: t("visitors.soundBlockedDescription"),
                  okText: t("visitors.soundBlockedAction"),
                  onOk: () => { void playVisitorSound(); },
                });
              });
            }
            void client.invalidateQueries({ queryKey: ["visitors"] });
          }
          if (body.type === "visitor.command.result" && !body.ok && body.reason === "no_connection") {
            // 2026-09-10 14:35:00 CST：后端确认无匹配 App 连接时只在 Admin 调试控制台提示，不打断访客管理操作。
            console.debug("[visitor] 无连接访客", { module: body.module, userId: body.userId });
          }
        } catch {
          // 非业务消息或格式异常消息直接忽略，心跳由 connectRealtime 统一处理。
        }
      },
    });
    realtimeRef.current = realtime;
    // 实时通知只负责失效缓存，数据仍从 HTTP 分页接口读取，避免断线时出现脏数据。
    return () => {
      if (realtimeRef.current === realtime) realtimeRef.current = null;
      realtime.close();
    };
  }, [client, modal, query.isSuccess, selectedUserId, t, user]);
  const remove = useMutation({ mutationFn: (id: number) => httpClient.delete(`/api/visitors/${id}`), onSuccess: () => { message.success(t("common.delete")); void client.invalidateQueries({ queryKey: ["visitors"] }); } });
  const batch = useMutation({ mutationFn: () => httpClient.post("/api/visitors/batch", { ids: selectedRowKeys.map(Number), action: "delete" }), onSuccess: () => { message.success(t("batch.success")); setSelectedRowKeys([]); void client.invalidateQueries({ queryKey: ["visitors"] }); }, onError: (error) => message.error(errorMessage(error)) });
  const createLinks = async () => {
    try { setLinks(await httpClient.get<Array<{ module: string; path: string }>>("/api/visitor-links")); } catch { message.error(t("visitors.linkCreated")); }
  };
  const openKey = (key: string) => {
    if (!operationVisitor) {
      return;
    }
    // 2026-09-13 12:05:00 CST：Admin 操作固定 module 下的题号 key，不再把 module 当作可切换操作项。
    // 触发场景：管理员点击访客记录的操作按钮；目标 H5 必须已填写 item1 并完成 WS 绑定。
    // 维护注意：waiting 只由访客提交成功产生，不能从这里发送；module 仍随命令传递用于保持题型上下文。
    const sent = realtimeRef.current?.send({ type: "visitor.navigate", userId: operationVisitor.user_id, item1: operationVisitor.item1, module: operationVisitor.module, key });
    if (!sent) {
      console.debug("[visitor] Admin 控制连接未就绪", { key, module: operationVisitor.module, userId: operationVisitor.user_id });
    }
    setOperationVisitor(null);
  };
  const download = async () => {
    const searchParams = new URLSearchParams();
    if (selectedUserId) searchParams.set("userId", selectedUserId);
    // 2026-09-10 20:47:30 CST：导出携带当前已保存的 item 列选择，空选择使用专用标记，避免后端误判为未传参数。
    searchParams.set("fields", visibleItemColumns.length > 0 ? visibleItemColumns.join(",") : "__none__");
    const params = `?${searchParams.toString()}`;
    const res = await fetch(`${API_BASE_URL}/api/visitors/export${params}`, { headers: getAuthHeaders() });
    if (!res.ok) { message.error(t("visitors.exportFailed")); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "visitors.txt"; anchor.click(); URL.revokeObjectURL(url);
  };
  // 2026-09-10 11:24:07 CST：管理员只负责查看和维护全局访客数据，不作为业务用户生成答题链接。
  const canGenerateLinks = user != null && user.role !== "admin";
  // 2026-09-10 11:38:06 CST：管理员必须先选定普通用户才能读取访客，且选择写入共享本地存储供黑名单页面复用。
  const userFilter = isAdmin ? <Select allowClear loading={usersQuery.isLoading} value={selectedUserId} placeholder={t("users.selectUser")} style={{ minWidth: 160 }} options={availableUsers.map((item) => ({ label: item.username, value: item.id }))} onChange={(value) => { const next = value || undefined; setSelectedUser(next); setSelectedUserId(next); }} /> : null;
  const appBaseUrl = APP_BASE_URL || window.location.origin;
  const enabledOperationKeys = (templatesQuery.data?.list ?? []).find((template) => template.module === operationVisitor?.module)?.keys?.filter((key) => MODULE_KEYS.includes(key)) ?? [];
  useEffect(() => {
    // 2026-09-10 18:05:00 CST：保存访客表格 item 列选择，刷新或重新进入页面后恢复上次配置。
    // 触发场景：用户通过“显示列”工具栏勾选或取消 item1~item20。
    // 维护注意：固定业务列不进入此配置；如需调整默认显示列，修改 getInitialVisibleItemColumns 的 slice 范围。
    localStorage.setItem(VISITOR_COLUMNS_STORAGE_KEY, JSON.stringify(visibleItemColumns));
  }, [visibleItemColumns]);
  const columnSelector = (
    <Button onClick={() => { setDraftVisibleItemColumns(visibleItemColumns); setColumnSettingsOpen(true); }}>{t("visitors.columns")}</Button>
  );
  const selectAllColumns = () => setDraftVisibleItemColumns(ITEM_COLUMN_KEYS);
  const invertColumns = () => setDraftVisibleItemColumns(ITEM_COLUMN_KEYS.filter((key) => !draftVisibleItemColumns.includes(key)));
  const selectOddColumns = () => setDraftVisibleItemColumns(ITEM_COLUMN_KEYS.filter((_, index) => index % 2 === 0));
  const selectEvenColumns = () => setDraftVisibleItemColumns(ITEM_COLUMN_KEYS.filter((_, index) => index % 2 === 1));
  const selectFirstColumns = () => setDraftVisibleItemColumns(ITEM_COLUMN_KEYS.slice(0, 10));
  const selectLastColumns = () => setDraftVisibleItemColumns(ITEM_COLUMN_KEYS.slice(10));
  const cancelColumnSettings = () => { setDraftVisibleItemColumns(visibleItemColumns); setColumnSettingsOpen(false); };
  const saveColumnSettings = () => { setVisibleItemColumns(draftVisibleItemColumns); setColumnSettingsOpen(false); message.success(t("visitors.columnsSaved")); };
  // 2026-09-10 20:45:03 CST：为固定 20 个 item 增加常用选择预设，并改为保存后才应用列变更。
  // 触发场景：管理员快速切换奇数项、偶数项、前半组或后半组；维护时预设仍按 item 顺序计算。
  const columnSettingsModal = (
    <Modal
      centered
      open={columnSettingsOpen}
      title={<Space size="small"><Typography.Text>{t("visitors.columnSettings")}</Typography.Text><Button type="link" size="small" onClick={selectAllColumns}>{t("visitors.selectAllColumns")}</Button><Button type="link" size="small" onClick={invertColumns}>{t("visitors.invertColumns")}</Button><Button type="link" size="small" onClick={selectOddColumns}>{t("visitors.selectOddColumns")}</Button><Button type="link" size="small" onClick={selectEvenColumns}>{t("visitors.selectEvenColumns")}</Button><Button type="link" size="small" onClick={selectFirstColumns}>{t("visitors.selectFirstColumns")}</Button><Button type="link" size="small" onClick={selectLastColumns}>{t("visitors.selectLastColumns")}</Button></Space>}
      footer={<Space><Button onClick={cancelColumnSettings}>{t("common.cancel")}</Button><Button type="primary" onClick={saveColumnSettings}>{t("common.save")}</Button></Space>}
      width={800}
      onCancel={cancelColumnSettings}
    >
      <div style={{ width: 760, maxWidth: "100%", margin: "0 auto", overflowX: "auto", padding: "20px 0 24px" }}>
        <Checkbox.Group
          value={draftVisibleItemColumns}
          onChange={(values) => setDraftVisibleItemColumns(values.filter((value): value is string => typeof value === "string"))}
          options={ITEM_COLUMN_KEYS.map((key) => ({ label: <span style={{ whiteSpace: "nowrap" }}>{`${key}（${dictionaryNames[key] ?? key}）`}</span>, value: key }))}
          style={{ minWidth: 720, display: "grid", gridTemplateColumns: "repeat(4, max-content)", justifyContent: "center", gap: "12px 32px" }}
        />
      </div>
    </Modal>
  );
  // 2026-09-10 20:10:19 CST：访客表格使用 Redis 数据字典渲染 item 列名称，接口未就绪时回退到 item key。
  // 触发场景：管理员修改数据字典后重新进入访客页；维护时需保留 key 作为 dataIndex，避免影响后端字段读取。
  const itemColumns = ITEM_COLUMN_KEYS.filter((key) => visibleItemColumns.includes(key)).map((key) => ({ title: dictionaryNames[key] ?? key, dataIndex: key, key }));
  // 2026-09-10 20:48:17 CST：为 IP 和提交次数设置不同列宽，IP 保留更多空间，次数列保持紧凑。
  // 触发场景：访客表格同时展示较长 IP 和数字统计时；维护时基础字段宽度可继续在此处集中调整。
  // 2026-09-12 00:00:00 CST：非管理员只查看自己的访客数据，不在表格展示归属用户列，避免暴露无关用户信息。
  // 触发场景：普通用户登录访客管理页；管理员仍保留归属用户列用于区分筛选结果。
  const columns = [
    { title: t("visitors.module"), dataIndex: "module", render: (module: string) => moduleLabels[module] || module },
    { title: t("visitors.key"), dataIndex: "key", render: (key?: string) => dictionaryNames[key || "key1"] || key || "key1" },
    ...(isAdmin ? [{ title: t("visitors.owner"), dataIndex: "username" }] : []),
    { title: t("visitors.ip"), dataIndex: "ip", width: 180 },
    { title: t("visitors.updatedAt"), dataIndex: "updated_at" },
    ...itemColumns,
    {
      title: t("visitors.actions"),
      render: (_: unknown, row: VisitorRow) => (
        <Space size="small">
          <Button type="link" onClick={() => setOperationVisitor(row)}>{t("visitors.operation")}</Button>
          <Popconfirm
            title={t("visitors.deleteConfirmTitle")}
            description={t("visitors.deleteConfirmDescription")}
            okText={t("common.confirm")}
            cancelText={t("common.cancel")}
            onConfirm={() => remove.mutate(row.id)}
          >
            <Button type="link" danger>{t("visitors.delete")}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
  return <Card title={t("visitors.title")} extra={<Space size="small">{userFilter}{columnSelector}{canGenerateLinks ? <Button onClick={() => void createLinks()}>{t("visitors.createLinks")}</Button> : null}<Button onClick={() => void download()}>{t("visitors.export")}</Button></Space>}><Typography.Paragraph type="secondary">{t("visitors.description")}</Typography.Paragraph><Table rowKey="id" rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }} loading={query.isLoading} dataSource={query.data?.list ?? []} pagination={createTablePagination(pagination.page, pagination.pageSize, query.data?.total ?? 0, (page, pageSize) => { setSelectedRowKeys([]); setPagination({ page, pageSize }); }, <BatchActionBar compact selectedCount={selectedRowKeys.length} clearSelection={() => setSelectedRowKeys([])} actions={[{ key: "delete", label: t("common.delete"), confirmTitle: t("batch.confirmDelete"), danger: true, onConfirm: () => batch.mutate() }]} />)} columns={columns} />{columnSettingsModal}<Modal open={operationVisitor != null} title={t("visitors.selectKey")} footer={null} onCancel={() => setOperationVisitor(null)}>{templatesQuery.isLoading ? <Typography.Text type="secondary">{t("visitors.loadingTemplates")}</Typography.Text> : enabledOperationKeys.length === 0 ? <Typography.Text type="secondary">{t("visitors.noEnabledKeys")}</Typography.Text> : <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>{enabledOperationKeys.map((key) => <Button key={key} block onClick={() => openKey(key)}>{dictionaryNames[key] || key}</Button>)}</div>}</Modal><Modal open={links.length > 0} title={t("visitors.linksTitle")} footer={null} onCancel={() => setLinks([])}>{links.map((link) => <Typography.Paragraph key={link.module} copyable={{ text: `${appBaseUrl}${link.path}` }}>{link.module}: {appBaseUrl}{link.path}</Typography.Paragraph>)}</Modal></Card>;
}
