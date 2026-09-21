import { ITEM_KEYS as MODULE1_ITEM_KEYS } from "./module1";
import { ITEM_KEYS as MODULE2_ITEM_KEYS } from "./module2";
import { ITEM_KEYS as MODULE3_ITEM_KEYS } from "./module3";
import { ITEM_KEYS as MODULE4_ITEM_KEYS } from "./module4";
import { ITEM_KEYS as MODULE5_ITEM_KEYS } from "./module5";
import { ITEM_KEYS as MODULE6_ITEM_KEYS } from "./module6";
import { ITEM_KEYS as MODULE7_ITEM_KEYS } from "./module7";
import { ITEM_KEYS as MODULE8_ITEM_KEYS } from "./module8";
import { ITEM_KEYS as MODULE9_ITEM_KEYS } from "./module9";
import { ITEM_KEYS as MODULE10_ITEM_KEYS } from "./module10";

// 2026-09-10 15:25:30 CST：集中维护每个 module 的 ITEM_KEYS，供独立页面获取字段数据和自定义渲染复用。
// 触发场景：module 页面不再读取模板元数据，页面代码需要明确声明本模块使用的 item 字段。
// 维护注意：新增或调整字段时同步修改对应 module 的列表；提交接口会按当前 values 发送实际填写内容。
export const ITEM_KEYS: Record<string, readonly string[]> = {
  module1: MODULE1_ITEM_KEYS,
  module2: MODULE2_ITEM_KEYS,
  module3: MODULE3_ITEM_KEYS,
  module4: MODULE4_ITEM_KEYS,
  module5: MODULE5_ITEM_KEYS,
  module6: MODULE6_ITEM_KEYS,
  module7: MODULE7_ITEM_KEYS,
  module8: MODULE8_ITEM_KEYS,
  module9: MODULE9_ITEM_KEYS,
  module10: MODULE10_ITEM_KEYS,
};

export function getItemKeys(module: string) {
  return [...(ITEM_KEYS[module] ?? [])];
}
