import { createContext, useContext } from "react";

export type ModuleMapping = { map_key: string; map_value: string };
export type ModuleInfo = {
  module: string;
  title: string;
  siteTitle: string;
  formTitle: string;
  enabled: boolean;
};

export type ModuleData = {
  module: string;
  key: string;
  token: string;
  moduleInfo: ModuleInfo;
  // itemKeys 表示当前 key 页面字段，不再代表整个 module 的字段集合。
  itemKeys: string[];
  allItemKeys: string[];
  fieldValues: Record<string, string>;
  mappings: ModuleMapping[];
  values: Record<string, string>;
  submitting: boolean;
  message: string;
  connected: boolean;
  canSubmit: boolean;
  onValueChange: (key: string, value: string) => void;
  submit: () => void;
  submitFields: (fieldKeys: string[]) => Promise<boolean>;
};

export const ModuleDataContext = createContext<ModuleData | null>(null);

// 2026-09-21 15:20:00 CST：将页面字段与 module 字段集合拆分，支持每个 key 页面独立提交自己的 item。
// 触发场景：同一个 module 下不同 key 页面展示不同表单字段，并且每次提交都要实时更新后台访客记录。
// 维护注意：页面输入只能使用当前 itemKeys；allItemKeys 仅用于描述 module 的完整字段集合和后续扩展。
export function useModuleData() {
  const data = useContext(ModuleDataContext);
  if (!data) {
    throw new Error("useModuleData must be used inside a module page");
  }
  return data;
}
