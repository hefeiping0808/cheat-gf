import { API_BASE_URL } from "./constants";
import { AUTH_ENDPOINTS } from "@/api/auth";
import { expireAdminSession } from "@/utils/authSession";

export class ApiError extends Error {
  code: number | string;
  constructor(code: number | string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

export class HttpError extends Error {
  status: number;
  responseMessage: string;
  constructor(status: number, message: string, responseMessage = "") {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.responseMessage = responseMessage;
  }
}

type RequestOptions = Omit<RequestInit, "method" | "body"> & {
  params?: Record<string, string | number | null | undefined>;
};

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const base = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  if (!params) return base;
  const url = new URL(base, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

// 2026-09-12 00:00:00 CST：统一从 admin 认证状态提取 Authorization header，保证所有后台 API 请求携带认证信息。
// 触发场景：路由守卫通过后请求用户、访客、模板等后台接口；h5 请求不经过该客户端。
// 维护注意：不要把 h5 的查询 token 写入这里，访客 token 只能作为 h5 业务参数传递。
export function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem("auth-storage");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const token = parsed?.state?.tokens?.accessToken;
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    // noop
  }
  return {};
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const url = buildUrl(path, options?.params);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
    ...(options?.headers as Record<string, string>),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });

  // 2026-10-03 00:53:15 CST：后台 API 的 401 统一清除管理员认证并通知路由层返回登录页。
  // 触发场景：token 已失效或后台拒绝当前会话；登录接口 401 代表账号凭据错误，必须保留在登录页展示接口 message。
  if (res.status === 401 && path !== AUTH_ENDPOINTS.login) expireAdminSession();

  if (!res.ok) {
    // 2026-10-02 17:00:13 CST：先读取一次错误响应正文，再兼容 JSON 和 text/plain，避免 401 等错误丢失后端提示。
    // 触发场景：认证失败或反向代理返回非 JSON 错误；维护时不要再次消费 response body，也不要把 HTML 错误页直接展示给用户。
    const bodyText = await res.text().catch(() => "");
    let errorBody: { code?: number | string; message?: string } | null = null;
    if (bodyText) {
      try {
        errorBody = JSON.parse(bodyText) as { code?: number | string; message?: string };
      } catch {
        // text/plain 响应由下面的回退分支处理。
      }
    }
    if (errorBody?.code !== undefined) {
      throw new ApiError(errorBody.code, errorBody.message ?? String(errorBody.code));
    }
    const responseMessage = errorBody?.message?.trim()
      || (res.headers.get("content-type")?.toLowerCase().includes("text/plain") ? bodyText.trim() : "");
    throw new HttpError(
      res.status,
      responseMessage || `HTTP ${res.status}: ${res.statusText}`,
      responseMessage,
    );
  }

  const json = await res.json();

  if (json.code !== undefined && json.code !== 0) {
    throw new ApiError(json.code, json.message ?? "Unknown error");
  }

  return json.data !== undefined ? json.data : json;
}

export const httpClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, undefined, options),
};
