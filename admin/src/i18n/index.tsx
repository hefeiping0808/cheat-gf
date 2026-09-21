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
        // 2026-09-13 10:05:31 CST：批量接口需要把后端返回的具体失败原因展示给用户；已知错误码仍使用本地化文案，未知错误回退到接口 message。
        const localized = messageTables[language][`errors.${code}`] ?? messageTables["zh-CN"][`errors.${code}`];
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
