import { createFileRoute } from "@tanstack/react-router";
import { App, Button, Card, Form, Input, Modal, Space, Table } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type Key } from "react";
import { businessApi, type MappingRow } from "@/api/business";
import { httpClient } from "@/utils/http";
import { useI18n } from "@/i18n";
import { createTablePagination } from "@/utils/tablePagination";
import { BatchActionBar } from "@/components/BatchActionBar";

export const Route = createFileRoute("/admin/_auth/mappings/")({ component: MappingsPage });

function MappingsPage() {
  const { t, errorMessage } = useI18n();
  const { message } = App.useApp();
  const client = useQueryClient();
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  // 2026-09-12 00:00:00 CST：新增字段映射改为弹窗表单，避免在卡片标题区域长期占用输入空间。
  // 触发场景：管理员点击“新增映射”按钮；维护时新增和编辑应分别使用独立 Form，避免表单状态互相污染。
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MappingRow | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const query = useQuery({ queryKey: ["mappings", pagination.page, pagination.pageSize], queryFn: () => businessApi.mappings(pagination.page, pagination.pageSize) });
  const save = useMutation({ mutationFn: (value: { key: string; value: string }) => httpClient.post("/api/mappings", value), onSuccess: () => { message.success(t("mappings.saved")); setAdding(false); form.resetFields(); void client.invalidateQueries({ queryKey: ["mappings"] }); } });
  const update = useMutation({ mutationFn: ({ id, key, value }: { id: number; key: string; value: string }) => httpClient.put(`/api/mappings/${id}`, { key, value }), onSuccess: () => { message.success(t("mappings.saved")); setEditing(null); editForm.resetFields(); void client.invalidateQueries({ queryKey: ["mappings"] }); } });
  const remove = useMutation({ mutationFn: (id: number) => httpClient.delete(`/api/mappings/${id}`), onSuccess: () => { message.success(t("mappings.deleted")); void client.invalidateQueries({ queryKey: ["mappings"] }); } });
  const batch = useMutation({ mutationFn: () => httpClient.post("/api/mappings/batch", { ids: selectedRowKeys.map(Number), action: "delete" }), onSuccess: () => { message.success(t("batch.success")); setSelectedRowKeys([]); void client.invalidateQueries({ queryKey: ["mappings"] }); }, onError: (error) => message.error(errorMessage(error)) });
  const openEdit = (row: MappingRow) => {
    setEditing(row);
    editForm.setFieldsValue({ key: row.map_key, value: row.map_value });
  };
  const closeEdit = () => {
    setEditing(null);
    editForm.resetFields();
  };
  const closeAdd = () => {
    setAdding(false);
    form.resetFields();
  };

  return <Card title={t("mappings.title")} extra={<Button type="primary" onClick={() => setAdding(true)}>{t("mappings.add")}</Button>}><Table rowKey="id" rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }} loading={query.isLoading} dataSource={query.data?.list ?? []} pagination={createTablePagination(pagination.page, pagination.pageSize, query.data?.total ?? 0, (page, pageSize) => { setSelectedRowKeys([]); setPagination({ page, pageSize }); }, <BatchActionBar compact selectedCount={selectedRowKeys.length} clearSelection={() => setSelectedRowKeys([])} actions={[{ key: "delete", label: t("common.delete"), confirmTitle: t("batch.confirmDelete"), danger: true, onConfirm: () => batch.mutate() }]} />)} columns={[{ title: t("mappings.key"), dataIndex: "map_key" }, { title: t("mappings.value"), dataIndex: "map_value" }, { title: t("visitors.actions"), render: (_: unknown, row: MappingRow) => <Space size="small"><Button type="link" onClick={() => openEdit(row)}>{t("common.edit")}</Button><Button type="link" danger onClick={() => remove.mutate(row.id)}>{t("common.delete")}</Button></Space> }]} /><Modal open={adding} title={t("mappings.addTitle")} footer={null} onCancel={closeAdd}><Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}><Form.Item label={t("mappings.key")} name="key" rules={[{ required: true, message: t("mappings.keyRequired") }]}><Input placeholder={t("mappings.keyPlaceholder")} /></Form.Item><Form.Item label={t("mappings.value")} name="value" rules={[{ required: true, message: t("mappings.valueRequired") }]}><Input placeholder={t("mappings.valuePlaceholder")} /></Form.Item><Space><Button onClick={closeAdd}>{t("common.cancel")}</Button><Button type="primary" htmlType="submit" loading={save.isPending}>{t("common.save")}</Button></Space></Form></Modal><Modal open={editing != null} title={`${t("common.edit")}${t("mappings.title")}`} footer={null} onCancel={closeEdit}><Form form={editForm} layout="vertical" onFinish={(v) => editing && update.mutate({ id: editing.id, key: v.key, value: v.value })}><Form.Item label={t("mappings.key")} name="key" rules={[{ required: true, message: t("mappings.keyRequired") }]}><Input /></Form.Item><Form.Item label={t("mappings.value")} name="value" rules={[{ required: true, message: t("mappings.valueRequired") }]}><Input /></Form.Item><Space><Button onClick={closeEdit}>{t("common.cancel")}</Button><Button type="primary" htmlType="submit" loading={update.isPending}>{t("common.save")}</Button></Space></Form></Modal></Card>;
}
