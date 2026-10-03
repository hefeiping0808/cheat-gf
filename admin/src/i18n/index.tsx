import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import antdEnUS from "antd/locale/en_US";
import antdZhCN from "antd/locale/zh_CN";
import enUS from "./en-US.json";
import zhCN from "./zh-CN.json";
import { HttpError } from "@/utils/http";

export type Language = "zh-CN" | "en-US";
type Messages = Record<string, string>;

const LANGUAGE_STORAGE_KEY = "admin-language";
const messageTables: Record<Language, Messages> = { "zh-CN": zhCN, "en-US": enUS };
const antdLocales = { "zh-CN": antdZhCN, "en-US": antdEnUS };

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string | number>, fallback?: string) => string;
  antdLocale: typeof antdZhCN;
  errorMessage: (error: unknown, fallbackKey?: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "zh-CN";
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en-US" ? "en-US" : "zh-CN";
}

function replaceParams(value: string, params?: Record<string, string | number>): string {
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // 2026-09-10 11:12:22 CST：语言状态集中管理并持久化，保证页面文案与 Ant Design 内置组件同步切换。
  const [language, setLanguageState] = useState<Language>(getStoredLanguage);
  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const t = useCallback(
    (key: string, params?: Record<string, string | number>, fallback?: string) => {
      const value = messageTables[language][key] ?? messageTables["zh-CN"][key] ?? fallback ?? key;
      return replaceParams(value, params);
    },
    [language],
  );
  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      antdLocale: antdLocales[language],
      errorMessage: (error: unknown, fallbackKey = "errors.UNKNOWN") => {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : "HTTP_ERROR";
        // 2026-10-02 17:00:13 CST：非 JSON HTTP 错误也可能携带可读正文，必须先于通用 HTTP_ERROR 本地化返回。
        // 触发场景：后端或反向代理以 text/plain 返回认证失败原因；空正文继续交给下面的通用错误码映射。
        if (error instanceof HttpError && error.responseMessage) return error.responseMessage;
        // 2026-09-13 10:05:31 CST：批量接口需要把后端返回的具体失败原因展示给用户；已知错误码仍使用本地化文案，未知错误回退到接口 message。
        const localized = messageTables[language][`errors.${code}`] ?? messageTables["zh-CN"][`errors.${code}`];
        // 2026-10-02 17:03:00 CST：通用 HTTP_ERROR 文案不能覆盖 API 正文里的具体认证失败原因。
        // 触发场景：登录接口返回 JSON 错误码但该码只映射到“请求失败”；已知业务码仍优先使用专属本地化文案。
        if (code === "HTTP_ERROR" && error instanceof Error && error.message) return error.message;
        if (localized) return localized;
        if (error instanceof Error && error.message) return error.message;
        return t(fallbackKey, undefined, t("errors.UNKNOWN"));
      },
    }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}
