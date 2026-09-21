function normalizeBaseUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

const explicitBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
const modeBaseUrl = normalizeBaseUrl(
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_PRO_API_BASE_URL
    : import.meta.env.VITE_DEV_API_BASE_URL,
);

const explicitAppBaseUrl = normalizeBaseUrl(import.meta.env.VITE_APP_BASE_URL);
const modeAppBaseUrl = normalizeBaseUrl(
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_PRO_APP_BASE_URL
    : import.meta.env.VITE_DEV_APP_BASE_URL,
);

// 2026-09-10 13:03:24 CST：Admin 的 HTTP 和 WebSocket 统一使用按 mode 解析的后端地址，避免 WS 落到 Vite 端口。
// 触发场景：开发环境未配置通用 API 地址时，Admin 需要直接连接 GoFrame 的 8000 端口。
// 维护注意：通用 VITE_API_BASE_URL 优先级最高；生产环境未配置 PRO 地址时保留同源相对请求。
export const API_BASE_URL =
  explicitBaseUrl || modeBaseUrl || (import.meta.env.MODE === "production" ? "" : "http://localhost:8000");

// 2026-09-10 14:20:00 CST：Admin 跳转访客答题页时单独解析 App 地址，避免开发环境把答题路由打开在 Admin 的 5174 端口。
// 触发场景：管理员从访客记录进入指定 module 页面；生产环境可配置独立 App 域名，未配置时回退同源。
// 维护注意：VITE_APP_BASE_URL 优先级最高，开发/生产变量分别使用 VITE_DEV_APP_BASE_URL 和 VITE_PRO_APP_BASE_URL。
export const APP_BASE_URL =
  // 2026-09-12 00:00:00 CST：app 与 admin 合并为同一 Vite 应用，未配置独立域名时必须使用当前 origin。
  // 触发场景：Admin 生成 h5 访客链接；维护时只有显式配置独立域名才允许跨 origin。
  explicitAppBaseUrl || modeAppBaseUrl || "";

/** Favicon path under `public/` (Vite serves as site root). */
export const APP_FAVICON_SRC = "/favicon.svg";

/** Product / brand name (login header, sidebar logo text, etc.). */
export const APP_BRAND_NAME = "Antd Admin";
