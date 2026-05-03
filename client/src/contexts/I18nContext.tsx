import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import zh, { type Translations } from "@shared/i18n/zh";
import en from "@shared/i18n/en";

export type Lang = "zh" | "en";

const STORAGE_KEY = "chileoma_lang";
const dicts: Record<Lang, Translations> = { zh, en };

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return path;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : path;
}

function translate(dict: Translations, key: string, vars?: Record<string, string | number>): string {
  const str = getNestedValue(dict as unknown as Record<string, unknown>, key);
  if (!vars) return str;
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), str);
}

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "zh") return stored;
    } catch { /* ignore */ }
    return "zh";
  });

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(dicts[lang], key, vars),
    [lang],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used inside I18nProvider");
  return ctx;
}
