import { createFileRoute } from "@tanstack/react-router";
import { App, Button, Card, Form, Input, Modal, Table, Typography } from "antd";
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
  const [form] = Form.useForm<{ label: string }>();
  const [bulkForm] = Form.useForm<Record<string, string>>();
  const query = useQuery({ queryKey: ["dictionary", pagination.page, pagination.pageSize], queryFn: () => businessApi.dictionary(pagination.page, pagination.pageSize) });
  const save = useMutation({
    // 2026-09-13 13:28:55 CST：只允许修改固定 item/key 的展示名称，字段 key 由后端路由锁定。
    // 触发场景：管理员将默认字段或题号 key 替换为实际业务名称；维护时不要把 key 放回表单让用户编辑。
    mutationFn: ({ key, label }: { key: string; label: string }) => httpClient.put(`/api/dictionary/${key}`, { label }),
    onSuccess: () => {
      message.success(t("dictionary.saved"));
      setOpen(false);
      setEditing(null);
      form.resetFields();
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
    form.setFieldsValue({ label: row.label });
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
    <Card title={t("dictionary.title")}>
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
          { title: t("common.edit"), render: (_: unknown, row: DataDictionaryRow) => <Button type="link" onClick={() => edit(row)}>{t("common.edit")}</Button> },
        ]}
      />
      <Modal open={open} title={editing ? `${t("dictionary.editTitle")}：${editing.key}` : t("dictionary.editTitle")} onCancel={close} okText={t("common.save")} cancelText={t("common.cancel")} onOk={() => form.submit()} confirmLoading={save.isPending}>
        <Form form={form} layout="vertical" onFinish={(value) => editing && save.mutate({ key: editing.key, label: value.label })}>
          <Form.Item label={t("dictionary.key")}><Input value={editing?.key ?? ""} disabled /></Form.Item>
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
