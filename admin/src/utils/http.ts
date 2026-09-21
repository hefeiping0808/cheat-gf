import { API_BASE_URL } from "./constants";

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
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
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

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as
      | { code?: number | string; message?: string }
      | null;
    if (errorBody?.code !== undefined) {
      throw new ApiError(errorBody.code, errorBody.message ?? String(errorBody.code));
    }
    throw new HttpError(res.status, `HTTP ${res.status}: ${res.statusText}`);
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
