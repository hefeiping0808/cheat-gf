import { useEffect, useMemo, useRef, useState } from "react";
import { Spin } from "antd";
import { API_BASE_URL } from "@/utils/constants";
import { connectRealtime, type RealtimeConnection } from "./realtime";
import { getItemKeys, getPageItemKeys } from "./templates/itemKeys";
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
  const values = Object.fromEntries(itemKeys.map((key) => [key, key === "item1" ? item1 : ""]));
  // 2026-09-21 15:20:00 CST：即使当前页面不展示 item1，也把 Zustand 中的身份字段放入共享值，供独立提交自动携带。
  // 触发场景：后续 key 页面只填写自己的 item，但后端仍需要 item1 定位同一条访客记录。
  // 维护注意：item1 不是页面字段时不要渲染输入框，提交层会单独从该值构建请求。
  if (!Object.prototype.hasOwnProperty.call(values, "item1")) values.item1 = item1;
  return values;
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
  const pageLoading = useH5Store((state) => state.pageLoading);
  const setPageLoading = useH5Store((state) => state.setPageLoading);
  const clearSession = useH5Store((state) => state.clear);
  const currentItem1Ref = useRef("");
  const realtimeRef = useRef<RealtimeConnection | null>(null);
  const pageLoadingTimerRef = useRef<number | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [mappings, setMappings] = useState<ModuleMapping[]>([]);
  const [moduleInfo, setModuleInfo] = useState<ModuleInfo | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dataReady, setDataReady] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [connected, setConnected] = useState(false);
  const waiting = key === "waiting";
  const allItemKeys = useMemo(() => getItemKeys(module), [module]);
  const itemKeys = useMemo(() => getPageItemKeys(module, key), [key, module]);
  const ModuleComponent = moduleComponents[module];
  const item1 = values.item1?.trim() || storedItem1.trim();

  useEffect(() => {
    // 2026-09-27 13:25:48 CST：H5 挂载时清理持久化残留的 loading，并在路由卸载时停止模拟请求计时器。
    // 触发场景：页面刷新或离开期间 Zustand 中仍保存 pageLoading=true；初始化后不能让遮罩永久显示。
    // 维护注意：loading 状态由 Zustand 统一保存，计时器只负责在约 200ms 后复位状态。
    setPageLoading(false);
    return () => {
      if (pageLoadingTimerRef.current !== null) {
        window.clearTimeout(pageLoadingTimerRef.current);
      }
    };
  }, [setPageLoading]);

  const showSubmitLoading = () => {
    // 2026-09-27 13:39:32 CST：仅在表单校验通过并准备请求时显示全屏 loading。
    // 触发场景：常规表单提交或滑块验证通过后提交；普通按钮、切换选项和打开弹窗不触发。
    // 维护注意：页面状态保存在 Zustand；定时器约 200ms 后复位，真实请求仍由 submitting 状态管理。
    setPageLoading(true);
    if (pageLoadingTimerRef.current !== null) {
      window.clearTimeout(pageLoadingTimerRef.current);
    }
    pageLoadingTimerRef.current = window.setTimeout(() => {
      pageLoadingTimerRef.current = null;
      setPageLoading(false);
    }, 400);
  };

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
    // 2026-09-21 15:20:00 CST：当前 key 变化时只初始化当前页面字段，保留 Zustand 中的 item1 作为访客身份。
    // 触发场景：Admin 下发新的 key 页面；每个页面独立提交，不能把上一个页面的输入误提交到当前页面。
    // 维护注意：切换页面会清空当前页面的临时输入，但不会清除已持久化的 item1。
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
      // 2026-10-02 01:00:38 CST：H5 心跳附带最新 Zustand key，避免切页后后台访客题号停留在旧值。
      // 触发场景：每次 WS 心跳或重连首包；维护时从 getState 读取，避免闭包持有旧 key。
      heartbeatPayload: () => ({ type: "ping", key: toVisitorKey(useH5Store.getState().key) || "key1" }),
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
    realtimeRef.current = realtime;
    return () => {
      if (realtimeRef.current === realtime) realtimeRef.current = null;
      realtime.close();
      setConnected(false);
    };
  }, [item1, module, setKey, setModule, token]);

  useEffect(() => {
    if (!connected) return;
    // 2026-10-02 01:00:38 CST：key 变化时立即发一条携带题号的 ping，不必等待下一次周期心跳。
    // 触发场景：本地页面切换、恢复 waiting 状态或后台控制切页；周期心跳继续作为失联检测和状态兜底。
    realtimeRef.current?.send({ type: "ping", key: toVisitorKey(key) || "key1" });
  }, [connected, key]);

  const onValueChange = (key: string, value: string) => {
    if (!itemKeys.includes(key)) return;
    if (key === "item1") currentItem1Ref.current = value.trim();
    setValues((current) => ({ ...current, [key]: value }));
  };

  const canSubmit = itemKeys.length > 0 && Boolean(item1) && itemKeys.every((key) => key === "item1" ? Boolean(item1) : values[key]?.trim().length > 0);
  // 2026-09-27 02:08:30 CST：允许当前 H5 页面按实际展示的字段子集提交。
  // 触发场景：module6 登录方式切换后，滑块验证只提交当前表单字段，避免隐藏字段被通用校验强制要求。
  // 维护注意：提交字段必须属于当前 key 的 itemKeys；item1 仍作为访客记录的稳定身份自动补齐。
  const submitFields = async (fieldKeys: string[]) => {
    const selectedKeys = Array.from(new Set(fieldKeys));
    if (selectedKeys.some((fieldKey) => fieldKey !== "item1" && !itemKeys.includes(fieldKey))) return false;
    const submitKeys = Array.from(new Set(["item1", ...selectedKeys]));
    const canSubmitSelectedFields = submitKeys.every((fieldKey) =>
      fieldKey === "item1" ? Boolean(item1) : Boolean(values[fieldKey]?.trim()),
    );
    if (!token || !canSubmitSelectedFields || submitting) return false;

    showSubmitLoading();
    // 2026-09-21 15:20:00 CST：独立提交当前 key 页面字段，并自动补齐 item1 作为后台访客记录的稳定身份。
    // 触发场景：同一 module 的多个 key 页面逐页提交；后端按 module、用户和 item1 更新同一条记录。
    // 维护注意：不要改为 allItemKeys，否则未填写的其他页面字段会阻止本页提交或覆盖已有答案。
    const items = Object.fromEntries(submitKeys.map((fieldKey) => [fieldKey, fieldKey === "item1" ? item1 : values[fieldKey] ?? ""]));
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
        // 2026-09-21 15:20:00 CST：每个页面提交成功后都进入 waiting，等待 Admin 下发下一个 key，避免访客越过后台流程。
        // 触发场景：当前 key 页面字段提交成功；本次答案已经写入后台，后续页面继续复用同一个 item1 身份。
        // 维护注意：waiting 不是模板可配置 key，只有提交成功或后端状态同步可以进入该状态。
        setItem1(item1);
        setKey("waiting");
        return true;
      }
    } catch {
      setMessage("网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
    return false;
  };
  const submit = () => submitFields(itemKeys);

  const pageContent = waiting ? <PageWaiting /> : !hasHydrated || !module || !token || !ModuleComponent || !dataReady || !moduleInfo ? null : (
    <ModuleDataContext.Provider value={{ module, key, token, moduleInfo, itemKeys, allItemKeys, fieldValues, mappings, values, submitting, message, connected, canSubmit, onValueChange, submit, submitFields }}>
      <ModuleComponent />
    </ModuleDataContext.Provider>
  );

  return (
    <div className="min-h-screen" aria-busy={pageLoading}>
      {pageContent}
      {pageLoading && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30" role="status" aria-live="polite">
          <Spin size="large" tip="" />
        </div>
      )}
    </div>
  );
}
