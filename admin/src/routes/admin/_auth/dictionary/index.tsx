import { createFileRoute } from "@tanstack/react-router";
import { App, Button, Card, Form, Input, Modal, Popconfirm, Space, Table, Typography } from "antd";
import { useState, type Key } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { businessApi, type DataDictionaryRow } from "@/api/business";
import { httpClient } from "@/utils/http";
import { useI18n } from "@/i18n";
import { createTablePagination } from "@/utils/tablePagination";
import { BatchActionBar } from "@/components/BatchActionBar";

export const Route = createFileRoute("/admin/_auth/dictionary/")({ component: DictionaryPage });

function DictionaryPage() {
  const { message } = App.useApp();
  const { t, errorMessage } = useI18n();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DataDictionaryRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
  const [form] = Form.useForm<{ key: string; label: string }>();
  const [bulkForm] = Form.useForm<Record<string, string>>();
  const query = useQuery({ queryKey: ["dictionary", pagination.page, pagination.pageSize], queryFn: () => businessApi.dictionary(pagination.page, pagination.pageSize) });
  const save = useMutation({
    // 2026-09-30 01:47:55 CST：key 是字典主键，编辑仅改 label；创建时才允许填写 key。
    // 触发场景：编辑系统默认项或自定义项时，固定 key 可避免现有访客/模板字段映射失联。
    mutationFn: ({ key, label }: { key: string; label: string }) => businessApi.updateDictionary(key, label),
    onSuccess: () => {
      message.success(t("dictionary.saved"));
      setOpen(false);
      setEditing(null);
      form.resetFields();
      void client.invalidateQueries({ queryKey: ["dictionary"] });
    },
    onError: (error) => message.error(errorMessage(error)),
  });
  const create = useMutation({
    mutationFn: (entry: { key: string; label: string }) => businessApi.createDictionary(entry),
    onSuccess: () => {
      message.success(t("dictionary.created"));
      setOpen(false);
      form.resetFields();
      setPagination((current) => ({
        ...current,
        page: Math.floor((query.data?.total ?? 0) / current.pageSize) + 1,
      }));
      void client.invalidateQueries({ queryKey: ["dictionary"] });
    },
    onError: (error) => message.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (key: string) => businessApi.deleteDictionary(key),
    onSuccess: (_data, key) => {
      message.success(t("dictionary.deleted"));
      setSelectedRowKeys((keys) => keys.filter((value) => value !== key));
      if (pagination.page > 1 && (query.data?.total ?? 0) <= (pagination.page - 1) * pagination.pageSize + 1) {
        setPagination((current) => ({ ...current, page: current.page - 1 }));
      }
      void client.invalidateQueries({ queryKey: ["dictionary"] });
    },
    onError: (error) => message.error(errorMessage(error)),
  });
  const bulkSave = useMutation({
    mutationFn: (values: Record<string, string>) => httpClient.post("/api/dictionary/batch", { updates: Object.entries(values).map(([key, label]) => ({ key, label })) }),
    onSuccess: () => { message.success(t("batch.success")); setBulkOpen(false); bulkForm.resetFields(); setSelectedRowKeys([]); void client.invalidateQueries({ queryKey: ["dictionary"] }); },
    onError: (error) => message.error(errorMessage(error)),
  });
  const edit = (row: DataDictionaryRow) => {
    setEditing(row);
    form.setFieldsValue({ key: row.key, label: row.label });
    setOpen(true);
  };
  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setEditing(null);
    form.resetFields();
  };
  const openBulkEdit = () => {
    const values = Object.fromEntries((query.data?.list ?? []).filter((row) => selectedRowKeys.includes(row.key)).map((row) => [row.key, row.label]));
    bulkForm.setFieldsValue(values);
    setBulkOpen(true);
  };

  return (
    <Card title={t("dictionary.title")} extra={<Button type="primary" onClick={openCreate}>{t("dictionary.add")}</Button>}>
      <Typography.Paragraph type="secondary">{t("dictionary.description")}</Typography.Paragraph>
      <Table
        rowKey="key"
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        loading={query.isLoading}
        dataSource={query.data?.list ?? []}
        pagination={createTablePagination(pagination.page, pagination.pageSize, query.data?.total ?? 0, (page, pageSize) => { setSelectedRowKeys([]); setPagination({ page, pageSize }); }, <BatchActionBar compact selectedCount={selectedRowKeys.length} clearSelection={() => setSelectedRowKeys([])} actions={[{ key: "edit", label: t("common.edit"), confirmTitle: t("batch.confirmEdit"), onConfirm: openBulkEdit }]} />)}
        columns={[
          { title: t("dictionary.key"), dataIndex: "key" },
          { title: t("dictionary.label"), dataIndex: "label" },
          { title: t("common.edit"), render: (_: unknown, row: DataDictionaryRow) => <Space size="small"><Button type="link" onClick={() => edit(row)}>{t("common.edit")}</Button><Popconfirm title={t("dictionary.deleteConfirmTitle")} description={t("dictionary.deleteConfirmDescription")} okText={t("common.confirm")} cancelText={t("common.cancel")} onConfirm={() => remove.mutate(row.key)}><Button type="link" danger loading={remove.isPending && remove.variables === row.key}>{t("common.delete")}</Button></Popconfirm></Space> },
        ]}
      />
      <Modal open={open} title={editing ? `${t("dictionary.editTitle")}：${editing.key}` : t("dictionary.createTitle")} onCancel={close} okText={t("common.save")} cancelText={t("common.cancel")} onOk={() => form.submit()} confirmLoading={save.isPending || create.isPending}>
        <Form form={form} layout="vertical" onFinish={(value) => editing ? save.mutate({ key: editing.key, label: value.label }) : create.mutate(value)}>
          <Form.Item name="key" label={t("dictionary.key")} rules={editing ? [] : [{ required: true, message: t("dictionary.keyRequired") }, { pattern: /^[A-Za-z][A-Za-z0-9_-]{0,63}$/, message: t("dictionary.keyPattern") }]}><Input maxLength={64} disabled={Boolean(editing)} placeholder={editing ? undefined : t("dictionary.keyPlaceholder")} /></Form.Item>
          <Form.Item name="label" label={t("dictionary.label")} rules={[{ required: true, message: t("dictionary.labelRequired") }]}><Input maxLength={255} /></Form.Item>
        </Form>
      </Modal>
      <Modal open={bulkOpen} title={t("dictionary.bulkEditTitle")} onCancel={() => { setBulkOpen(false); bulkForm.resetFields(); }} okText={t("common.save")} cancelText={t("common.cancel")} onOk={() => bulkForm.submit()} confirmLoading={bulkSave.isPending}>
        <Form form={bulkForm} layout="vertical" onFinish={(values) => bulkSave.mutate(values)}>
          {(query.data?.list ?? []).filter((row) => selectedRowKeys.includes(row.key)).map((row) => (
            <Form.Item key={row.key} name={row.key} label={`${row.key}：${t("dictionary.label")}`} rules={[{ required: true, message: t("dictionary.labelRequired") }]}>
              <Input maxLength={255} />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </Card>
  );
}
