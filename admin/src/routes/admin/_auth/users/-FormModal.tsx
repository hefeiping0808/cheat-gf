import { Form, Input } from "antd";
import type { FormInstance } from "antd/es/form";
import type { CreateUserRequest, User } from "@/api/schemas";
import { BaseFormModal } from "@/components/FormModal";
import { useI18n } from "@/i18n";

export type FormModalProps = {
  open: boolean;
  editingUser: User | null;
  form: FormInstance<CreateUserRequest>;
  confirmLoading: boolean;
  onCancel: () => void;
  onFinish: (values: CreateUserRequest) => void;
};

export function FormModal({
  open,
  editingUser,
  form,
  confirmLoading,
  onCancel,
  onFinish,
}: FormModalProps) {
  const { t } = useI18n();
  return (
    <BaseFormModal<CreateUserRequest>
      open={open}
      title={editingUser ? t("users.editTitle") : t("users.createTitle")}
      okText={t("common.confirm")}
      cancelText={t("common.cancel")}
      form={form}
      confirmLoading={confirmLoading}
      onCancel={onCancel}
      onFinish={onFinish}
    >
      <Form.Item
        name="username"
        label={t("users.username")}
        rules={[{ required: true, message: t("users.usernameRequired") }]}
      >
        <Input />
      </Form.Item>
      {/* 2026-09-10 10:52:40 CST：角色由后端固定为普通用户，管理端只展示角色，不参与新增或编辑提交。 */}
      <Form.Item name="email" label={t("user.email")}>
        <Input />
      </Form.Item>
    </BaseFormModal>
  );
}
