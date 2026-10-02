import { createFileRoute } from "@tanstack/react-router";
import { App, Button, Card, Form, Input, Select, Space, Table, Tag, Typography } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type Key } from "react";
import { httpClient } from "@/utils/http";
import { businessApi, type BlacklistRow } from "@/api/business";
import { useI18n } from "@/i18n";
import { useAuthStore } from "@/stores/auth";
import { getSelectedUserId, setSelectedUserId } from "@/utils/selectedUser";
import { createTablePagination } from "@/utils/tablePagination";
import { BatchActionBar } from "@/components/BatchActionBar";
import { IpRegionDisplay } from "@/components/IpRegionDisplay";

export const Route = createFileRoute("/admin/_auth/blacklist/")({ component: BlacklistPage });

function BlacklistPage() {
  const { message } = App.useApp();
  const { t, errorMessage } = useI18n();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";
  const [selectedUserId, setSelectedUser] = useState<string | undefined>(() => getSelectedUserId());
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const client = useQueryClient();
  const [form] = Form.useForm<{ ip: string }>();
  const usersQuery = useQuery({ queryKey: ["user-options"], queryFn: businessApi.userOptions, enabled: isAdmin });
  const availableUsers = (usersQuery.data ?? []).filter((item) => item.role !== "admin");
  const selectedUserIsValid = !isAdmin || (usersQuery.isSuccess && Boolean(selectedUserId) && availableUsers.some((item) => item.id === selectedUserId));
  const query = useQuery({ queryKey: ["blacklist", selectedUserId, pagination.page, pagination.pageSize], queryFn: () => businessApi.blacklist(pagination.page, pagination.pageSize, selectedUserId), enabled: selectedUserIsValid });
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
  const add = useMutation({
    mutationFn: (values: { ip: string }) => httpClient.post("/api/blacklist", values),
    onSuccess: () => { message.success(t("blacklist.added")); form.resetFields(); void client.invalidateQueries({ queryKey: ["blacklist"] }); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => httpClient.delete(`/api/blacklist/${id}`),
    onSuccess: () => { message.success(t("blacklist.removed")); void client.invalidateQueries({ queryKey: ["blacklist"] }); },
  });
  const batch = useMutation({
    mutationFn: () => httpClient.post("/api/blacklist/batch", { ids: selectedRowKeys.map(Number), action: "delete" }),
    onSuccess: () => { message.success(t("batch.success")); setSelectedRowKeys([]); void client.invalidateQueries({ queryKey: ["blacklist"] }); },
    onError: (error) => message.error(errorMessage(error)),
  });
  // 2026-09-10 11:38:06 CST：管理员必须先选定普通用户才能读取黑名单，且选择写入共享本地存储供访客页面复用。
  const userFilter = isAdmin ? <Select allowClear loading={usersQuery.isLoading} value={selectedUserId} placeholder={t("users.selectUser")} style={{ minWidth: 160 }} options={availableUsers.map((item) => ({ label: item.username, value: item.id }))} onChange={(value) => { const next = value || undefined; setSelectedUser(next); setSelectedUserId(next); }} /> : null;
  return <Card title={t("blacklist.title")} extra={<Space size="small">{userFilter}<Form layout="inline" form={form} onFinish={(v) => add.mutate(v)}><Form.Item name="ip" rules={[{ required: true, message: t("blacklist.ipRequired") }]}><Input placeholder={t("blacklist.ipPlaceholder")} /></Form.Item><Button type="primary" htmlType="submit">{t("blacklist.add")}</Button></Form></Space>}>
    <Typography.Paragraph type="secondary">{t("blacklist.description")}</Typography.Paragraph>
    <Table rowKey="id" rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }} loading={query.isLoading} dataSource={query.data?.list ?? []} pagination={createTablePagination(pagination.page, pagination.pageSize, query.data?.total ?? 0, (page, pageSize) => { setSelectedRowKeys([]); setPagination({ page, pageSize }); }, <BatchActionBar compact selectedCount={selectedRowKeys.length} clearSelection={() => setSelectedRowKeys([])} actions={[{ key: "delete", label: t("common.remove"), confirmTitle: t("batch.confirmDelete"), danger: true, onConfirm: () => batch.mutate() }]} />)} columns={[{ title: t("blacklist.user"), dataIndex: "username" }, { title: t("blacklist.ip"), dataIndex: "ip", render: (v: string) => <Tag color="red"><IpRegionDisplay ip={v} /></Tag> }, { title: t("blacklist.createdAt"), dataIndex: "created_at" }, { title: t("blacklist.actions"), render: (_: unknown, row: BlacklistRow) => <Button danger type="link" onClick={() => remove.mutate(row.id)}>{t("common.remove")}</Button> }]} />
  </Card>;
}
