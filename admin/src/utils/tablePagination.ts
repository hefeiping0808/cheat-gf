import type { ReactNode } from "react";

export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// 2026-09-10 20:16:48 CST：统一管理端表格分页选项，避免不同页面绕过后端 pageSize 上限。
// 触发场景：用户切换任意管理表格的每页条数；新增表格应复用此配置保持交互一致。
export function createTablePagination(
  current: number,
  pageSize: number,
  total: number,
  onChange: (page: number, pageSize: number) => void,
  leftContent?: ReactNode,
) {
  return {
    current,
    pageSize,
    total,
    showSizeChanger: true,
    pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
    // 2026-09-13 10:20:00 CST：将批量操作栏放入分页组件的 showTotal 区域，保证按钮固定出现在分页最左侧。
    // 触发场景：业务表格存在选中记录时；未选中时保持分页原有布局。
    showTotal: () => leftContent ?? null,
    onChange,
  };
}
