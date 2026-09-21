import { createFileRoute } from "@tanstack/react-router";
import { App, Button, Card, Form, Input, Modal, Popconfirm, Space, Switch, Table } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type Key } from "react";
import { businessApi, type UserRow } from "@/api/business";
import { httpClient } from "@/utils/http";
import { useI18n } from "@/i18n";
import { createTablePagination } from "@/utils/tablePagination";
import { BatchActionBar } from "@/components/BatchActionBar";

export const Route = createFileRoute("/admin/_auth/users/")({ component: UsersPage });
type UserForm = { username: string; password?: string; disabled?: boolean };

function UsersPage() {
  const { message } = App.useApp(); const { t, errorMessage } = useI18n(); const client = useQueryClient(); const [open, setOpen] = useState(false); const [editing, setEditing] = useState<UserRow | null>(null); const [form] = Form.useForm<UserForm>();
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 }); const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const query = useQuery({ queryKey: ["users", pagination.page, pagination.pageSize], queryFn: () => businessApi.users(pagination.page, pagination.pageSize) });
  const save = useMutation({ mutationFn: (value: UserForm) => {
    // 2026-09-10 11:51:06 CST：编辑用户时只提交允许修改的字段，用户名保持只读，避免前端误提交旧用户名触发修改。
    if (editing) return httpClient.put(`/api/users/${editing.id}`, { password: value.password, disabled: value.disabled });
    return httpClient.post("/api/users", value);
  }, onSuccess: () => { message.success(editing ? t("users.updated") : t("users.created")); setOpen(false); setEditing(null); form.resetFields(); void client.invalidateQueries({ queryKey: ["users"] }); }, onError: (error) => message.error(errorMessage(error)) });
  const remove = useMutation({ mutationFn: (id: string) => httpClient.delete(`/api/users/${id}`), onSuccess: () => { message.success(t("users.deleted")); void client.invalidateQueries({ queryKey: ["users"] }); }, onError: (error) => message.error(errorMessage(error)) });
  const batch = useMutation({ mutationFn: (action: "delete" | "enable" | "disable") => httpClient.post("/api/users/batch", { ids: selectedRowKeys.map(String).map(Number), action }), onSuccess: () => { message.success(t("batch.success")); setSelectedRowKeys([]); void client.invalidateQueries({ queryKey: ["users"] }); }, onError: (error) => message.error(errorMessage(error)) });
  const edit = (row: UserRow) => {
    // 2026-09-10 11:51:06 CST：管理员账号由系统维护，管理端不开放编辑入口；后端仍会再次校验，防止绕过页面直接调用接口。
    if (row.role === "admin") return;
    setEditing(row); form.setFieldsValue({ username: row.username, disabled: row.disabled }); setOpen(true);
  };
  return <Card title={t("users.title")} extra={<Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>{t("users.create")}</Button>}><Table rowKey="id" rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys, getCheckboxProps: (row: UserRow) => ({ disabled: row.role === "admin" }) }} loading={query.isLoading} dataSource={query.data?.list ?? []} pagination={createTablePagination(pagination.page, pagination.pageSize, query.data?.total ?? 0, (page, pageSize) => { setSelectedRowKeys([]); setPagination({ page, pageSize }); }, <BatchActionBar compact selectedCount={selectedRowKeys.length} clearSelection={() => setSelectedRowKeys([])} actions={[{ key: "enable", label: t("common.enabled"), confirmTitle: t("batch.confirmStatus", { action: t("common.enabled") }), onConfirm: () => batch.mutate("enable") }, { key: "disable", label: t("common.disabled"), confirmTitle: t("batch.confirmStatus", { action: t("common.disabled") }), onConfirm: () => batch.mutate("disable") }, { key: "delete", label: t("common.delete"), confirmTitle: t("batch.confirmDelete"), danger: true, onConfirm: () => batch.mutate("delete") }]} />)} columns={[{ title: t("users.username"), dataIndex: "username" }, { title: t("users.role"), dataIndex: "role", render: (v: string) => v === "admin" ? t("users.admin") : t("users.user") }, { title: t("users.status"), dataIndex: "disabled", render: (v: boolean) => v ? t("common.disabled") : t("common.normal") }, { title: t("users.actions"), render: (_: unknown, row: UserRow) => row.role === "admin" ? null : <Space><Button type="link" onClick={() => edit(row)}>{t("common.edit")}</Button><Popconfirm title={t("users.deleteConfirmTitle")} description={t("users.deleteConfirmDescription")} okText={t("common.confirm")} cancelText={t("common.cancel")} onConfirm={() => remove.mutate(row.id)}><Button type="link" danger>{t("common.delete")}</Button></Popconfirm></Space> }]} /><Modal open={open} title={editing ? t("users.editTitle") : t("users.createTitle")} onCancel={() => setOpen(false)} okText={t("common.confirm")} cancelText={t("common.cancel")} onOk={() => form.submit()} confirmLoading={save.isPending}><Form form={form} layout="vertical" onFinish={(value) => save.mutate(value)}><Form.Item name="username" label={t("users.username")} rules={[{ required: true, message: t("users.usernameRequired") }]}><Input disabled={Boolean(editing)} /></Form.Item><Form.Item name="password" label={editing ? t("users.newPasswordOptional") : t("login.password")} rules={editing ? [] : [{ required: true, message: t("users.passwordRequired") }]}><Input.Password /></Form.Item><Form.Item name="disabled" label={t("users.disabled")} valuePropName="checked"><Switch /></Form.Item></Form></Modal></Card>;
}
