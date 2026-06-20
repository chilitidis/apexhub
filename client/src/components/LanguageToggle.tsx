import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Compact EN/EL segmented toggle. English is shown first (default language),
 * Greek second. Works on both the dark landing page and the in-app surfaces.
 */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language"
      className={`inline-flex items-center rounded-lg border border-white/15 bg-white/5 p-0.5 ${className}`}
    >
      {(["en", "el"] as const).map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={active}
            className={`px-2.5 py-1 rounded-md font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              active
                ? "bg-gradient-to-br from-[#0094C6] to-[#005377] text-white shadow"
                : "text-white/55 hover:text-white"
            }`}
          >
            {code === "en" ? "EN" : "EL"}
          </button>
        );
      })}
    </div>
  );
}

export default LanguageToggle;
