import React, { createContext, useContext, useEffect, useState } from "react";
import { translations, type TranslationKey } from "@/lib/i18n";

export type Lang = "en" | "el";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  /** Translate a key for the active language; falls back to EN, then the key. */
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "utj_lang";

function readInitialLang(): Lang {
  // English is the default; Greek is the opt-in second choice.
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "el") return stored;
  } catch {
    /* localStorage unavailable (SSR / private mode) — fall through */
  }
  return "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readInitialLang());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore persistence errors */
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = (next: Lang) => setLangState(next);
  const toggleLang = () => setLangState(prev => (prev === "en" ? "el" : "en"));

  const t = (key: TranslationKey): string => {
    const table = translations[lang] as Record<string, string>;
    const fallback = translations.en as Record<string, string>;
    return table[key] ?? fallback[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}

/** Convenience hook returning just the translator function. */
export function useT() {
  return useLanguage().t;
}
