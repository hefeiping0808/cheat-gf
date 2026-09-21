import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/utils/constants";
import { connectRealtime, type RealtimeConnection } from "./realtime";
import { getItemKeys } from "./templates/itemKeys";
import { moduleComponents } from "./templates";
import { ModuleDataContext, type ModuleInfo, type ModuleMapping } from "./templates/moduleContext";
import { PageWaiting } from "./transitions/pageWaiting";
import { useH5Store } from "./store";

type ModuleDataPayload = { moduleInfo?: ModuleInfo; values?: Record<string, string> };
type ModuleDataResponse = { data?: ModuleDataPayload; message?: string };
type ModuleDebugDetails = Record<string, string | number | boolean | undefined>;

const MODULE_CODES: Record<string, string> = Object.fromEntries(
  Array.from({ length: 10 }, (_, index) => [`m${index + 1}`, `module${index + 1}`]),
);

function toInternalModule(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (MODULE_CODES[normalized]) return MODULE_CODES[normalized];
  // 2026-09-12 00:00:00 CST：兼容后端 WebSocket 仍下发 `module1` 格式，外部链接仍只允许使用 m1 格式。
  // 触发场景：旧后台连接向当前 h5 会话发送 visitor.navigate；统一在状态入口转换，避免新增旧路由。
  return /^module(?:[1-9]|10)$/.test(normalized) ? normalized : "";
}

function toVisitorKey(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "waiting" || /^key(?:[1-9]|1[0-9]|20)$/.test(normalized) ? normalized : "";
}

function stripH5Query() {
  window.history.replaceState(null, "", "/h5");
}

function debugModuleIssue(message: string, details?: ModuleDebugDetails) {
  if (details === undefined) {
    console.debug(`[h5] ${message}`);
    return;
  }
  console.debug(`[h5] ${message} ${JSON.stringify(details)}`);
}

function createInitialFormValues(itemKeys: string[], item1: string) {
  return Object.fromEntries(itemKeys.map((key) => [key, key === "item1" ? item1 : ""]));
}

export default function H5Page() {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialModule = useMemo(() => toInternalModule(query.get("m")), [query]);
  const initialToken = useMemo(() => query.get("t")?.trim() ?? "", [query]);
  const hasQueryParams = query.has("m") || query.has("t");
  const module = useH5Store((state) => state.module);
  const token = useH5Store((state) => state.token);
  const key = useH5Store((state) => state.key);
  const storedItem1 = useH5Store((state) => state.item1);
  const hasHydrated = useH5Store((state) => state.hasHydrated);
  const setSession = useH5Store((state) => state.setSession);
  const setModule = useH5Store((state) => state.setModule);
  const setKey = useH5Store((state) => state.setKey);
  const setItem1 = useH5Store((state) => state.setItem1);
  const clearSession = useH5Store((state) => state.clear);
  const currentItem1Ref = useRef("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [mappings, setMappings] = useState<ModuleMapping[]>([]);
  const [moduleInfo, setModuleInfo] = useState<ModuleInfo | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dataReady, setDataReady] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [connected, setConnected] = useState(false);
  const waiting = key === "waiting";
  const itemKeys = useMemo(() => getItemKeys(module), [module]);
  const ModuleComponent = moduleComponents[module];
  const item1 = values.item1?.trim() ?? "";

  useEffect(() => {
    if (!hasHydrated) return;
    if (initialModule && initialToken) {
      // 2026-09-13 12:05:00 CST：通过 m/t 进入新访客会话时固定从 key1 开始，避免沿用上一个链接的题号状态。
      // 触发场景：访客打开 Admin 生成的 H5 链接；无 m/t 的刷新路径不进入这里，因此会保留 h5-storage 中的 key。
      setSession(initialModule, initialToken, "key1");
      // 2026-09-12 00:00:00 CST：参数完成 Zustand 初始化后立即从地址栏移除，后续 h5 始终使用单一路由 `/h5`。
      // 触发场景：用户通过外部访客链接首次打开页面；维护时不要把 m/t 重新拼回 URL。
      stripH5Query();
      return;
    }
    if (hasQueryParams) {
      clearSession();
      stripH5Query();
      debugModuleIssue("h5 参数无效", { hasModule: Boolean(initialModule), hasToken: Boolean(initialToken) });
    }
  }, [clearSession, hasHydrated, hasQueryParams, initialModule, initialToken, setSession]);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    // 2026-09-13 12:05:00 CST：module 变化时清空题目答案，但保留持久化的 item1 访客标识，保证 Admin 后续仍能定向控制同一连接。
    // 触发场景：WebSocket 下发兼容性的 module 切换或 h5 刷新恢复；维护时不要清除 h5-storage 中的 item1。
    currentItem1Ref.current = storedItem1;
    const initialItem1 = storedItem1;
    setDataReady(false);
    setFieldValues({});
    setMappings([]);
    setModuleInfo(null);
    setValues(createInitialFormValues(itemKeys, initialItem1));
    setMessage("");

    if (!module || !token || itemKeys.length === 0) {
      if (module || token) debugModuleIssue("module 参数未声明或 token 缺失", { module, hasToken: Boolean(token) });
      return () => {
        disposed = true;
        controller.abort();
      };
    }

    const queryParams = new URLSearchParams({ token, keys: itemKeys.join(",") });
    fetch(`${API_BASE_URL}/api/public/module-data/${module}?${queryParams.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const rawBody = await response.text();
        let body: ModuleDataResponse = {};
        try {
          body = JSON.parse(rawBody) as ModuleDataResponse;
        } catch {
          // 2026-09-12 00:00:00 CST：兼容后端异常响应不是 JSON 的情况，h5 保持空白并记录调试信息。
        }
        return { body, response };
      })
      .then(({ body, response }) => {
        if (disposed) return;
        const data = body.data;
        if (!response.ok || !data?.values || !data.moduleInfo) {
          debugModuleIssue("module 数据请求未通过", { module, status: response.status, message: body.message });
          return;
        }
        const requestedValues = Object.fromEntries(itemKeys.map((key) => [key, data.values?.[key] ?? ""]));
        setFieldValues(requestedValues);
        setMappings(itemKeys.map((key) => ({ map_key: key, map_value: requestedValues[key] })));
        setModuleInfo(data.moduleInfo);
        setValues(createInitialFormValues(itemKeys, currentItem1Ref.current));
        setDataReady(true);
      })
      .catch((error: unknown) => {
        if (!disposed && !(error instanceof DOMException && error.name === "AbortError")) {
          debugModuleIssue("module 数据请求异常", { module, error: error instanceof Error ? error.message : String(error) });
        }
      });

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [itemKeys, module, storedItem1, token]);

  useEffect(() => {
    if (!token || !item1) {
      setConnected(false);
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const apiURL = new URL(API_BASE_URL || window.location.origin);
    const realtime: RealtimeConnection = connectRealtime({
      url: `${protocol}//${apiURL.host}/ws?r=0&module=${encodeURIComponent(module)}&item1=${encodeURIComponent(item1)}&token=${encodeURIComponent(token)}`,
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onError: () => setConnected(false),
      onMessage: (event) => {
        try {
          const body = JSON.parse(event.data) as { type?: string; module?: string; key?: string };
          const nextModule = toInternalModule(body.module);
          if (body.type === "visitor.navigate" && nextModule) {
            // 2026-09-13 12:05:00 CST：WebSocket 导航同时更新 module 和 key，页面实际题目由 module 组件读取上下文中的 key 决定。
            // 触发场景：Admin 操作已开启的 key；缺少 key 的旧消息回退到 key1，避免残留 waiting 状态。
            setModule(nextModule);
            setKey(toVisitorKey(body.key) || "key1");
          }
        } catch {
          // 非业务消息忽略，心跳由 connectRealtime 统一处理。
        }
      },
    });
    return () => {
      realtime.close();
      setConnected(false);
    };
  }, [item1, module, setKey, setModule, token]);

  const onValueChange = (key: string, value: string) => {
    if (!itemKeys.includes(key)) return;
    if (key === "item1") currentItem1Ref.current = value.trim();
    setValues((current) => ({ ...current, [key]: value }));
  };

  const canSubmit = itemKeys.length > 0 && itemKeys.every((key) => values[key]?.trim().length > 0);
  const submit = async () => {
    if (!token || !canSubmit || submitting) return;
    const items = Object.fromEntries(itemKeys.map((key) => [key, values[key] ?? ""]));
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/public/visitors/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, key, token, items, requestId: crypto.randomUUID() }),
      });
      const body = (await response.json()) as { message?: string };
      setMessage(body.message ?? (response.ok ? "提交成功" : "提交失败"));
      if (response.ok) {
        // 2026-09-13 12:05:00 CST：提交成功后持久化访客标识并把 key 切换为 waiting，刷新页面仍停留在等待状态且可恢复 WS。
        // 触发场景：当前 module 的全部 ITEM_KEYS 提交成功；后续页面由 Admin WebSocket 下发 module/key 再切换。
        // 维护注意：waiting 不是模板可配置 key，只有提交成功或后端状态同步可以进入该状态。
        setItem1(item1);
        setKey("waiting");
      }
    } catch {
      setMessage("网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasHydrated || !module || !token || !ModuleComponent || !dataReady || !moduleInfo) {
    return waiting ? <PageWaiting /> : null;
  }

  if (waiting) {
    return <PageWaiting />;
  }

  return (
    <ModuleDataContext.Provider value={{ module, key, token, moduleInfo, itemKeys, fieldValues, mappings, values, submitting, message, connected, canSubmit, onValueChange, submit }}>
      <ModuleComponent />
    </ModuleDataContext.Provider>
  );
}
