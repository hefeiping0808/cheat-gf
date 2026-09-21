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
  itemKeys: string[];
  fieldValues: Record<string, string>;
  mappings: ModuleMapping[];
  values: Record<string, string>;
  submitting: boolean;
  message: string;
  connected: boolean;
  canSubmit: boolean;
  onValueChange: (key: string, value: string) => void;
  submit: () => void;
};

export const ModuleDataContext = createContext<ModuleData | null>(null);

// 2026-09-10 15:20:27 CST：为自定义 module 渲染提供统一数据上下文，路由层负责取数、提交和导航控制，页面只负责展示。
// 触发场景：业务方在 module 页面自行渲染 ITEM_KEYS 对应字段，不再依赖旧模板组件。
// 维护注意：组件必须通过 useModuleData 读取上下文，item1 变化会影响 App WS 的绑定连接。
export function useModuleData() {
  const data = useContext(ModuleDataContext);
  if (!data) {
    throw new Error("useModuleData must be used inside a module page");
  }
  return data;
}
