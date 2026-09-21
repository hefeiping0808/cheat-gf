import type { ComponentType } from "react";
import Module1Page from "./module1";
import Module2Page from "./module2";
import Module3Page from "./module3";
import Module4Page from "./module4";
import Module5Page from "./module5";
import Module6Page from "./module6";
import Module7Page from "./module7";
import Module8Page from "./module8";
import Module9Page from "./module9";
import Module10Page from "./module10";

export type ModulePageComponent = ComponentType;

// 2026-09-10 15:35:00 CST：建立 module 到独立页面文件的映射，路由只负责选择组件，不参与具体布局和样式。
// 触发场景：module 数据请求成功后渲染对应页面；每个 module 可独立修改 JSX、CSS class 和交互布局。
// 维护注意：新增 module 时同步增加页面导入和映射，并在 itemKeys.ts 中声明 ITEM_KEYS。
export const moduleComponents: Record<string, ModulePageComponent> = {
  module1: Module1Page,
  module2: Module2Page,
  module3: Module3Page,
  module4: Module4Page,
  module5: Module5Page,
  module6: Module6Page,
  module7: Module7Page,
  module8: Module8Page,
  module9: Module9Page,
  module10: Module10Page,
};
