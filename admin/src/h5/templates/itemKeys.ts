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
import { PAGE_ITEM_KEYS as MODULE1_PAGE_ITEM_KEYS } from "./module1";
import { PAGE_ITEM_KEYS as MODULE2_PAGE_ITEM_KEYS } from "./module2";
import { PAGE_ITEM_KEYS as MODULE3_PAGE_ITEM_KEYS } from "./module3";
import { PAGE_ITEM_KEYS as MODULE4_PAGE_ITEM_KEYS } from "./module4";
import { PAGE_ITEM_KEYS as MODULE5_PAGE_ITEM_KEYS } from "./module5";
import { PAGE_ITEM_KEYS as MODULE6_PAGE_ITEM_KEYS } from "./module6";
import { PAGE_ITEM_KEYS as MODULE7_PAGE_ITEM_KEYS } from "./module7";
import { PAGE_ITEM_KEYS as MODULE8_PAGE_ITEM_KEYS } from "./module8";
import { PAGE_ITEM_KEYS as MODULE9_PAGE_ITEM_KEYS } from "./module9";
import { PAGE_ITEM_KEYS as MODULE10_PAGE_ITEM_KEYS } from "./module10";

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

// 2026-09-22 02:20:00 CST：统一注册各 module 的页面字段配置，让每个 module 按自身 PAGE_ITEM_KEYS 管理 key 与 item 的关系。
// 触发场景：同一 module 的不同页面字段不一致；维护新 module 时先在对应模板声明 PAGE_ITEM_KEYS，再在这里登记。
// 维护注意：页面未配置具体 key 时继续回退 ITEM_KEYS，避免旧 module 因迁移配置缺失而无法提交。
const PAGE_ITEM_KEYS: Record<string, Record<string, readonly string[]>> = {
  module1: MODULE1_PAGE_ITEM_KEYS,
  module2: MODULE2_PAGE_ITEM_KEYS,
  module3: MODULE3_PAGE_ITEM_KEYS,
  module4: MODULE4_PAGE_ITEM_KEYS,
  module5: MODULE5_PAGE_ITEM_KEYS,
  module6: MODULE6_PAGE_ITEM_KEYS,
  module7: MODULE7_PAGE_ITEM_KEYS,
  module8: MODULE8_PAGE_ITEM_KEYS,
  module9: MODULE9_PAGE_ITEM_KEYS,
  module10: MODULE10_PAGE_ITEM_KEYS,
};

export function getItemKeys(module: string) {
  return [...(ITEM_KEYS[module] ?? [])];
}

// 2026-09-21 15:20:00 CST：按 module 和当前 key 返回页面实际需要的字段，未配置的旧 module 保持原有全字段行为。
// 触发场景：H5 通过 Admin WebSocket 切换 key 后，需要重新加载并提交当前页面自己的 item。
// 维护注意：新增 module 页面时优先补充 PAGE_ITEM_KEYS；不配置时会回退到该 module 的 ITEM_KEYS。
export function getPageItemKeys(module: string, key: string) {
  const configuredItemKeys = PAGE_ITEM_KEYS[module]?.[key];
  if (configuredItemKeys) return [...configuredItemKeys];

  // 2026-09-27 13:14:45 CST：未单独配置的 key3 固定使用 Page3 的 item2 字段。
  // 触发场景：module6-module10 等模板复用 Page3，但其默认 ITEM_KEYS 未包含 item2，导致共享输入更新函数拒绝输入。
  // 维护注意：若 Page3 的固定字段变化，同步调整这里的默认映射；各 module 显式 PAGE_ITEM_KEYS 配置仍优先。
  if (key === "key3" && ITEM_KEYS[module] !== undefined) return ["item2"];

  // 2026-09-27 13:47:29 CST：未单独配置的 key5 固定使用 Page5 OTP 的 item5 字段。
  // 触发场景：Page5 输入通过 item5 更新共享状态；缺少映射时 onValueChange 会按 module 默认字段拒绝该值，自动提交无法触发。
  // 维护注意：Page5 字段变化时同步调整该默认映射；显式 PAGE_ITEM_KEYS 配置仍优先。
  if (key === "key5" && ITEM_KEYS[module] !== undefined) return ["item5"];

  return [...(ITEM_KEYS[module] ?? [])];
}
