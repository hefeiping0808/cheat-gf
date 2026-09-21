import { Button, Input, Select, theme } from "antd";
import { Plus, UserRound } from "lucide-react";
import { forwardRef, useMemo } from "react";
import { FilterToolbar } from "@/components/FilterToolbar";
import { useI18n } from "@/i18n";

/** Search + role slot `minWidth` for FilterToolbar collapse math */
const FILTER_CONTROL_WIDTH = 220;

export type ToolbarProps = {
  keywordInput: string;
  onKeywordChange: (value: string) => void;
  onSearch: (keyword: string) => void;
  onClearSearch: () => void;
  roleValue: string | undefined;
  onRoleChange: (role: string) => void;
  onCreateClick: () => void;
};

export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(function Toolbar(
  {
    keywordInput,
    onKeywordChange,
    onSearch,
    onClearSearch,
    roleValue,
    onRoleChange,
    onCreateClick,
  },
  ref,
) {
  const { token } = theme.useToken();
  const { t } = useI18n();

  const slots = useMemo(
    () => [
      {
        key: "keyword",
        minWidth: FILTER_CONTROL_WIDTH,
        children: (
          <Input.Search
            allowClear
            placeholder={t("users.search")}
            style={{ width: FILTER_CONTROL_WIDTH }}
            value={keywordInput}
            onChange={(e) => onKeywordChange(e.target.value)}
            onSearch={(v) => onSearch(v)}
            onClear={onClearSearch}
          />
        ),
      },
      {
        key: "role",
        minWidth: FILTER_CONTROL_WIDTH,
        children: (
          <Select
            allowClear
            placeholder={t("users.roleFilter")}
            style={{ width: FILTER_CONTROL_WIDTH }}
            prefix={<UserRound size={token.fontSize} />}
            value={roleValue}
            onChange={(v) => onRoleChange(v ?? "")}
            options={[
              { label: t("users.admin"), value: "admin" },
              { label: t("users.user"), value: "user" },
            ]}
          />
        ),
      },
    ],
    [keywordInput, onClearSearch, onKeywordChange, onRoleChange, onSearch, roleValue, token.fontSize],
  );

  return (
    <FilterToolbar
      ref={ref}
      slots={slots}
      actions={
        <Button type="primary" icon={<Plus size={token.fontSize} />} onClick={onCreateClick}>
          {t("users.create")}
        </Button>
      }
      moreFiltersLabel={t("users.moreFilters")}
      moreFiltersTitle={t("users.moreFilters")}
    />
  );
});
