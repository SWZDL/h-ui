import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "./dict/en";
import ru from "./dict/ru";
import zhCn from "./dict/zh-cn";
import { extras } from "./extras";

type Dict = Record<string, unknown>;

type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> };

export const locales = [
  { value: "en", label: "English", short: "EN" },
  { value: "zh-cn", label: "简体中文", short: "简" },
  { value: "ru", label: "Русский", short: "RU" },
] as const;

export type Locale = (typeof locales)[number]["value"];

const STORAGE_KEY = "hui-locale";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Recursively merge the legacy dictionaries with the new frontend strings. */
function mergeDict(base: Dict, patch: Dict): Dict {
  const result: Dict = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const current = result[key];
    result[key] =
      isRecord(current) && isRecord(value) ? mergeDict(current, value) : value;
  }
  return result;
}

const dictionaries: Record<Locale, Dict> = {
  en: mergeDict(en as Dict, extras.en as unknown as Dict),
  "zh-cn": mergeDict(zhCn as Dict, extras["zh-cn"] as unknown as Dict),
  ru: mergeDict(ru as Dict, extras.ru as unknown as Dict),
};

function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "zh-cn" || stored === "ru") {
    return stored;
  }

  const candidates = [
    ...(navigator.languages ?? []),
    navigator.language ?? "",
  ].map((item) => item.toLowerCase());

  for (const language of candidates) {
    if (language.startsWith("zh")) return "zh-cn";
    if (language.startsWith("ru")) return "ru";
    if (language.startsWith("en")) return "en";
  }
  return "en";
}

function lookup(dict: Dict, path: string): string | undefined {
  const value = path.split(".").reduce<unknown>((acc, key) => {
    return isRecord(acc) ? acc[key] : undefined;
  }, dict);
  return typeof value === "string" ? value : undefined;
}

export type TVars = Record<string, string | number>;
export type TFunction = (key: string, vars?: TVars) => string;

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback<TFunction>(
    (key, vars) => {
      const template =
        lookup(dictionaries[locale], key) ?? lookup(dictionaries.en, key) ?? key;

      if (!vars) return template;

      return template.replace(/\{(\w+)\}/g, (match, name: string) => {
        const value = vars[name];
        return value === undefined ? match : String(value);
      });
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return context;
}

/** Convenience hook when only the translator is needed. */
export function useT(): TFunction {
  return useI18n().t;
}

export type { DeepPartial };
