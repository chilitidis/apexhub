// Lightweight i18n dictionary. English is the default language; Greek is the
// opt-in second choice. Core trading terms (trade, equity, win rate, lots,
// drawdown, profit factor, R-multiple, etc.) are intentionally kept in English
// in BOTH languages, as requested.

export const translations = {
  en: {
    // ---- Global navigation / common ----
    "nav.coach": "AI Coach",
    "nav.features": "Features",
    "nav.workflow": "How it works",
    "nav.pricing": "Pricing",
    "nav.faq": "FAQ",
    "common.signIn": "Sign in",
    "common.start": "Get started",
    "common.createAccount": "Create account",
    "common.haveAccount": "I already have an account",
    "lang.label": "Language",
    "lang.en": "EN",
    "lang.el": "EL",
  },
  el: {
    // ---- Global navigation / common ----
    "nav.coach": "AI Coach",
    "nav.features": "Δυνατότητες",
    "nav.workflow": "Πώς δουλεύει",
    "nav.pricing": "Τιμές",
    "nav.faq": "Συχνές ερωτήσεις",
    "common.signIn": "Σύνδεση",
    "common.start": "Ξεκίνα",
    "common.createAccount": "Δημιουργία λογαριασμού",
    "common.haveAccount": "Έχω ήδη λογαριασμό",
    "lang.label": "Γλώσσα",
    "lang.en": "EN",
    "lang.el": "EL",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];
