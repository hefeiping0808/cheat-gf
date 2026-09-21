import { createFileRoute } from "@tanstack/react-router";
import { App, Button, Card, Checkbox, Form, Input, Modal, Switch, Table, Typography } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type Key } from "react";
import { businessApi, type TemplateRow } from "@/api/business";
import { httpClient } from "@/utils/http";
import { useI18n } from "@/i18n";
import { createTablePagination } from "@/utils/tablePagination";
import { BatchActionBar } from "@/components/BatchActionBar";

export const Route = createFileRoute("/admin/_auth/templates/")({ component: TemplatesPage });

const TEMPLATE_KEYS = Array.from({ length: 20 }, (_, index) => `key${index + 1}`);

type TemplateForm = {
  label: string;
  keys: string[];
  title: string;
  siteTitle: string;
  formTitle: string;
};

function TemplatesPage() {
  const { t, errorMessage } = useI18n();
  const { message } = App.useApp();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [form] = Form.useForm<TemplateForm>();
  const query = useQuery({ queryKey: ["templates", pagination.page, pagination.pageSize], queryFn: () => businessApi.templates(pagination.page, pagination.pageSize) });
  const dictionaryQuery = useQuery({ queryKey: ["dictionary", "template-options"], queryFn: () => businessApi.dictionary(1, 40) });
  const keyLabels = useMemo(() => Object.fromEntries((dictionaryQuery.data?.list ?? []).filter((item) => item.key.startsWith("key")).map((item) => [item.key, item.label?.trim() || item.key])), [dictionaryQuery.data]);

  const toggle = useMutation({
    mutationFn: ({ module, enabled }: { module: string; enabled: boolean }) =>
      httpClient.put(`/api/templates/${module}`, { enabled }),
    onSuccess: () => {
      message.success(t("templates.updated"));
      void client.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (error) => message.error(errorMessage(error)),
  });
  const batch = useMutation({
    mutationFn: (action: "enable" | "disable") => httpClient.post("/api/templates/batch", { ids: selectedRowKeys.map(Number), action }),
    onSuccess: () => { message.success(t("batch.success")); setSelectedRowKeys([]); void client.invalidateQueries({ queryKey: ["templates"] }); },
    onError: (error) => message.error(errorMessage(error)),
  });

  const save = useMutation({
    // 2026-09-10 17:10:00 CST：只提交模板可编辑信息，module 由当前行路由参数决定，避免被表单修改。
    mutationFn: ({ module, value }: { module: string; value: TemplateForm }) =>
      httpClient.put(`/api/templates/${module}`, value),
    onSuccess: () => {
      message.success(t("templates.infoUpdated"));
      setOpen(false);
      setEditing(null);
      form.resetFields();
      void client.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  const edit = (row: TemplateRow) => {
    // 2026-09-10 17:10:00 CST：module 是固定业务标识，只作为展示字段，不放入编辑表单。
    setEditing(row);
    form.setFieldsValue({
      label: row.label ?? "",
      keys: row.keys ?? [],
      title: row.title ?? "",
      siteTitle: row.site_title ?? "",
      formTitle: row.form_title ?? "",
    });
    setOpen(true);
  };

  return (
    <Card title={t("templates.title")}>
      <Typography.Paragraph type="secondary">{t("templates.description")}</Typography.Paragraph>
      <Table
        rowKey="id"
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        loading={query.isLoading}
        dataSource={query.data?.list ?? []}
        pagination={createTablePagination(pagination.page, pagination.pageSize, query.data?.total ?? 0, (page, pageSize) => { setSelectedRowKeys([]); setPagination({ page, pageSize }); }, <BatchActionBar compact selectedCount={selectedRowKeys.length} clearSelection={() => setSelectedRowKeys([])} actions={[{ key: "enable", label: t("common.enabled"), confirmTitle: t("batch.confirmStatus", { action: t("common.enabled") }), onConfirm: () => batch.mutate("enable") }, { key: "disable", label: t("common.disabled"), confirmTitle: t("batch.confirmStatus", { action: t("common.disabled") }), onConfirm: () => batch.mutate("disable") }]} />)}
        columns={[
          { title: t("templates.module"), dataIndex: "module" },
          { title: t("templates.label"), render: (_: unknown, row: TemplateRow) => row.label?.trim() || row.module },
          { title: t("templates.name"), dataIndex: "title" },
          { title: t("templates.siteTitle"), dataIndex: "site_title" },
          { title: t("templates.formTitle"), dataIndex: "form_title" },
          {
            title: t("templates.enabled"),
            dataIndex: "enabled",
            render: (enabled: boolean, row: TemplateRow) => (
              <Switch checked={enabled} onChange={(value) => toggle.mutate({ module: row.module, enabled: value })} />
            ),
          },
          {
            title: t("common.edit"),
            render: (_: unknown, row: TemplateRow) => <Button type="link" onClick={() => edit(row)}>{t("common.edit")}</Button>,
          },
        ]}
      />
      <Modal
        open={open}
        title={editing ? `${t("templates.editTitle")}：${editing.module}` : t("templates.editTitle")}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields(); }}
        okText={t("common.save")}
        cancelText={t("common.cancel")}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(value) => editing && save.mutate({ module: editing.module, value })}>
          {/* 2026-09-13 11:35:12 CST：label 仅作为 module 的展示名称，允许留空并由仪表盘及相关表格回退显示原 module。 */}
          <Form.Item name="label" label={t("templates.label")} rules={[{ max: 128, message: t("templates.labelTooLong") }]}>
            <Input placeholder={editing?.module} maxLength={128} />
          </Form.Item>
          {/* 2026-09-12 00:00:00 CST：模板标题可能较长，统一使用默认五行的多行文本域，避免单行输入框截断编辑内容。 */}
          <Form.Item name="title" label={t("templates.name")}>
            <Input.TextArea rows={5} />
          </Form.Item>
          {/* 2026-09-13 13:43:59 CST：站点标题和表单标题作为单行配置项展示，避免编辑弹窗被多行输入框撑高。 */}
          <Form.Item name="siteTitle" label={t("templates.siteTitle")}>
            <Input />
          </Form.Item>
          <Form.Item name="formTitle" label={t("templates.formTitle")}>
            <Input />
          </Form.Item>
          {/* 2026-09-13 13:44:51 CST：将 keys 配置放到弹窗底部，标题相关字段编辑完成后再进行可操作项设置。 */}
          <Form.Item name="keys" label={t("templates.enabledKeys")}>
            <Checkbox.Group
              options={TEMPLATE_KEYS.map((key) => ({ label: keyLabels[key] || key, value: key }))}
              style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px 24px", width: "100%" }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
