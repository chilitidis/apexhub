// Full landing-page content in English (default) and Greek. Core trading terms
// (equity curve, win rate, profit factor, R-multiple, drawdown, RR, session,
// MT5, etc.) are kept in English in BOTH languages by design.
//
// NOTE: `testimonials` quotes are PLACEHOLDER copy approved for launch — swap
// them for real member testimonials here (no code changes needed elsewhere).
import type { Lang } from "@/contexts/LanguageContext";

export interface Feature {
  icon: string; // icon key resolved in Landing.tsx
  tone: string; // gradient key resolved in Landing.tsx
  title: string;
  text: string;
  badge?: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  per: string;
  /** Strikethrough "was" price shown under the amount (always visible). */
  was?: string;
  /** Small savings chip, e.g. "1 month free". */
  saveNote?: string;
  /** Alternate display when the Yearly toggle is active (monthly plan only). */
  priceYearly?: string;
  perYearly?: string;
  wasYearly?: string;
  bullets: string[];
  featured: boolean;
  badge?: string;
  cta: string;
}

export interface LandingContent {
  nav: { coach: string; features: string; workflow: string; pricing: string; faq: string };
  cta: { signIn: string; start: string; createAccount: string; haveAccount: string };
  hero: {
    badge: string;
    titleA: string;
    titleHighlight: string;
    subtitle: string; // **bold** segments marked with double asterisks
    ctaPrimary: string;
    ctaSecondary: string;
    check1: string;
    check2: string;
    check3: string;
  };
  heroMock: {
    month: string;
    acct: string;
    pl: string;
    plLabel: string;
    rows: Array<{ l: string; v: string; tone: "up" | "down" }>;
    winRateLabel: string;
    winRate: string;
    pfLabel: string;
    pf: string;
    coachTitle: string;
    coachMsg: string;
    coachTag: string;
    toastLead: string;
    toastBold: string;
    toastTail: string;
  };
  stats: Array<{ value: string; accent?: string; label: string }>;
  coach: {
    badge: string;
    title: string;
    subtitle: string;
    tradingTag: string;
    tradingTitle: string;
    tradingText: string;
    tradingBullets: string[];
    tradingFit: string;
    tradingNote: string;
    tradingChecks: Array<{ l: string; s: "ok" | "warn" | "bad" }>;
    statusLabels: { ok: string; warn: string; bad: string };
    mindsetTag: string;
    mindsetTitle: string;
    mindsetText: string;
    mindsetBullets: string[];
    mindsetUserMsg: string;
    mindsetReply: string;
    mindsetPrompts: string[];
    mindsetInput: string;
  };
  moreAi: {
    kicker: string;
    title: string;
    briefing: { title: string; time: string; sentimentLabel: string; sentimentText: string; impactLabel: string; impactValue: string };
    news: { title: string; filter: string; rows: Array<{ c: string; t: string; i: "HIGH" | "MED" }> };
    patterns: { title: string; range: string; rows: Array<{ l: string; v: string; tone: "up" | "down" | "plain" }> };
  };
  calendar: {
    kicker: string;
    title: string;
    text: string;
    bullets: string[];
    shotTitle: string;
    shotLegend: string;
  };
  features: { kicker: string; title: string; subtitle: string; items: Feature[] };
  testimonials: {
    kicker: string;
    title: string;
    spotlight: { pre: string; hl: string; post: string; initials: string; name: string; role: string };
    minis: Array<{ quote: string; name: string }>;
  };
  share: {
    kicker: string;
    title: string;
    heading: string;
    text: string;
    bullets: string[];
    card: {
      brand: string;
      month: string;
      big: string;
      pct: string;
      stats: Array<{ l: string; v: string }>;
      handle: string;
      url: string;
    };
  };
  workflow: { kicker: string; title: string; steps: Array<{ n: string; tone: string; title: string; text: string }> };
  pricing: {
    kicker: string;
    title: string;
    subtitle: string;
    toggle: { monthly: string; yearly: string; save: string };
    plans: PricingPlan[];
    footnote: string;
  };
  faq: { kicker: string; title: string; items: Array<[string, string]> };
  finalCta: { kicker: string; titleA: string; titleB: string; subtitle: string; cta: string };
  footer: { blurb: string; rights: string; secured: string };
}

const PLAN_PRICES = { monthly: "€39.99", semiannual: "€199.99", annual: "€399.99" };

const en: LandingContent = {
  nav: { coach: "AI Coach", features: "Features", workflow: "How it works", pricing: "Pricing", faq: "FAQ" },
  cta: { signIn: "Sign in", start: "Start free", createAccount: "Create account", haveAccount: "I already have an account" },
  hero: {
    badge: "Built for serious MT5 traders · now with an AI coach",
    titleA: "Every trade leaves a trail.",
    titleHighlight: "Learn to read it.",
    subtitle:
      "Ultimate Trading Journal syncs your MT5, turns your history into clean analytics and surfaces the patterns that cost you money — while the **AI Coach** trains both your strategy and your psychology.",
    ctaPrimary: "Start 7 days free",
    ctaSecondary: "Meet the AI Coach",
    check1: "No card required",
    check2: "Connect MT5 in 60s",
    check3: "Cancel anytime",
  },
  heroMock: {
    month: "JULY 2026",
    acct: "PROP · €50K",
    pl: "+€4,180",
    plLabel: "NET P/L · +8.4%",
    rows: [
      { l: "EURUSD · BUY", v: "+€620", tone: "up" },
      { l: "XAUUSD · SELL", v: "+€1,240", tone: "up" },
      { l: "GBPJPY · BUY", v: "-€310", tone: "down" },
    ],
    winRateLabel: "WIN RATE",
    winRate: "61%",
    pfLabel: "PROFIT FACTOR",
    pf: "1.9",
    coachTitle: "AI TRADING COACH",
    coachMsg:
      "“Your GBPJPY setup is against the H4 trend. In your last 12 similar trades you won only 25% — think twice.”",
    coachTag: "SETUP SCORE: MARGINAL 58/100",
    toastLead: "MT5 Sync:",
    toastBold: "14 new trades",
    toastTail: "imported",
  },
  stats: [
    { value: "1,100", accent: "+", label: "trades logged" },
    { value: "30", accent: "+", label: "active traders" },
    { value: "16", label: "tools in one journal" },
    { value: "12", label: "prop firms in the Tracker" },
    { value: "4.9", accent: "★", label: "member rating" },
  ],
  coach: {
    badge: "The reason traders stay",
    title: "Your personal AI trading & mindset coach",
    subtitle:
      "Most journals just store data. Ultimate Trading Journal analyzes your charts and your psychology — and tells you exactly what to fix.",
    tradingTag: "Trading Coach",
    tradingTitle: "Upload a chart. Get a scored, structured review.",
    tradingText:
      "Drop one or two TradingView screenshots (e.g. H1 + H4). A vision model reads the setup and returns a 0–100 score, a verdict, your risk:reward, a session read and a full criterion-by-criterion checklist — then you can ask “what should I fix?”.",
    tradingBullets: [
      "0–100 setup score with a clear verdict",
      "Per-criterion checklist: trend, structure, RR, timing",
      "Numeric risk:reward and session/timing read",
      "Ask follow-ups in chat after every review",
    ],
    tradingFit: "Valid setup",
    tradingNote:
      "Clean break & retest at the support zone, aligned with the H4 trend. Watch entry timing near the NY open.",
    tradingChecks: [
      { l: "Trend alignment", s: "ok" },
      { l: "Market structure", s: "ok" },
      { l: "Risk : reward ≥ 2", s: "ok" },
      { l: "Entry timing / session", s: "warn" },
      { l: "Stop placement", s: "bad" },
    ],
    statusLabels: { ok: "OK", warn: "WATCH", bad: "FIX" },
    mindsetTag: "Mindset Coach",
    mindsetTitle: "Beat the psychology that costs you money",
    mindsetText:
      "Revenge trading, FOMO, fear, breaking your own rules — the Mindset Coach is a conversational psychology coach that answers from a curated trading-psychology knowledge base, so you build a steady, disciplined mind.",
    mindsetBullets: [
      "Talk through fear, impatience, discipline & doubt",
      "Ready-made prompts to start with one click",
      "Grounded answers — not a generic chatbot",
    ],
    mindsetUserMsg: "I keep revenge-trading after a loss. How do I stop?",
    mindsetReply:
      "Revenge trading is your brain trying to “win back” the loss emotionally. Set a hard rule: after a loss, step away for 15 minutes and journal how you feel here first. The pause breaks the loop.",
    mindsetPrompts: ["I'm scared to pull the trigger", "I overtrade when I'm bored"],
    mindsetInput: "Ask the mindset coach…",
  },
  moreAi: {
    kicker: "And there's more AI",
    title: "Walk into every session prepared",
    briefing: {
      title: "Pre-Market Briefing",
      time: "07:00",
      sentimentLabel: "Sentiment:",
      sentimentText: "Risk-on · DXY softer pre-CPI.",
      impactLabel: "HIGH IMPACT TODAY",
      impactValue: "13:30 UTC · USD CPI",
    },
    news: {
      title: "Market News",
      filter: "High only",
      rows: [
        { c: "USD", t: "CPI m/m", i: "HIGH" },
        { c: "EUR", t: "ECB Speech", i: "MED" },
        { c: "GBP", t: "GDP q/q", i: "HIGH" },
      ],
    },
    patterns: {
      title: "Pattern Analysis",
      range: "30 days",
      rows: [
        { l: "Best day", v: "Thursday · 71% WR", tone: "up" },
        { l: "Worst hour", v: "09:00–10:00", tone: "down" },
        { l: "Top pair", v: "XAUUSD · +€2.1K", tone: "plain" },
      ],
    },
  },
  calendar: {
    kicker: "The journal",
    title: "See your month at a glance",
    text:
      "The P/L calendar turns your month into a heatmap — green days, red days and the patterns behind them. Click any day to see the trades that made it.",
    bullets: [
      "Daily P/L heatmap with win/loss counters",
      "Per-month KPIs, equity curve & drawdown",
      "Drag-and-drop Excel import for a whole month",
    ],
    shotTitle: "July · P/L Calendar",
    shotLegend: "Green = profit · red = loss",
  },
  features: {
    kicker: "The complete toolkit",
    title: "16 tools. One journal.",
    subtitle: "Everything a serious trader needs — from logging to AI coaching — under one roof.",
    items: [
      { icon: "Plus", tone: "blue", title: "Add Trade", text: "Log trades with screenshot scan and full notes" },
      { icon: "RefreshCw", tone: "tealA", title: "Sync MT5", text: "Auto-sync trades from your MetaTrader account" },
      { icon: "CalendarPlus", tone: "sky", title: "New Month", text: "Fresh month with starting balance & clean snapshot" },
      { icon: "ListChecks", tone: "mint", title: "Pre-Trade Check", text: "20-point checklist before every entry" },
      { icon: "Wallet", tone: "peach", title: "Cash Adjustment", text: "Deposits & withdrawals on the current account" },
      { icon: "TrendingUp", tone: "pink", title: "Compounding", text: "Compounding projections & risk % scenarios" },
      { icon: "FileSpreadsheet", tone: "slate", title: "Export Excel", text: "Your whole month as a workbook, one click" },
      { icon: "LayoutGrid", tone: "steel", title: "Accounts Overview", text: "All your accounts at a glance" },
      { icon: "CalendarDays", tone: "green", title: "Calendar", text: "Calendar view of your trades" },
      { icon: "Calculator", tone: "indigo", title: "Position Calculator", text: "Lot size based on balance & risk %" },
      { icon: "PieChart", tone: "violet", title: "Pattern Analysis", text: "Win rate by day, hour, instrument & setup" },
      { icon: "Brain", tone: "coralA", title: "Mindset Coach", text: "Psychological support & mindset training" },
      { icon: "LineChart", tone: "oceanTeal", title: "Trading Coach", text: "AI evaluates your setups against your strategy" },
      { icon: "Sun", tone: "amber", title: "Pre-Market Briefing", text: "Daily AI briefing with sentiment & bias" },
      { icon: "Newspaper", tone: "cyan", title: "Market News", text: "Economic calendar with high-impact events" },
      { icon: "Shield", tone: "forest", title: "Prop Firm Tracker", text: "Stay 100% within your funded account rules" },
    ],
  },
  testimonials: {
    kicker: "Our traders",
    title: "Results that speak for themselves",
    spotlight: {
      pre: "I passed the FTMO challenge on my second attempt. The difference? I could finally ",
      hl: "see my patterns",
      post: " — Pattern Analysis showed me most of my losses happened Monday mornings. I stopped trading Mondays. That was it.",
      initials: "GK",
      name: "Giorgos K.",
      role: "Funded trader · FTMO 100K",
    },
    minis: [
      { quote: "The Mindset Coach stopped me from revenge trading twice in the same week. Worth ten subscriptions.", name: "Maria P. · Swing trader" },
      { quote: "Connected my MT5 in one minute and everything synced itself. I'm never opening Excel again.", name: "Dimitris S. · Prop trader" },
      { quote: "The morning Pre-Market Briefing became part of my routine, right next to my coffee.", name: "Nikos A. · Day trader" },
    ],
  },
  share: {
    kicker: "Share your progress",
    title: "Your best month, in one card",
    heading: "One click turns your monthly stats into a share-ready card.",
    text:
      "A public, read-only snapshot with only the numbers you choose — perfect for Instagram stories, Telegram groups and Discord. No account balances, no sensitive data.",
    bullets: [
      "Branded link: ultimatradingjournal.com/share/…",
      "You decide what's visible and for how long",
      "The best ad for your trading — and your journal",
    ],
    card: {
      brand: "ULTIMATE TJ",
      month: "JULY 2026 · PROP",
      big: "+€4,180",
      pct: "+8.4%",
      stats: [
        { l: "TRADES", v: "42" },
        { l: "WIN RATE", v: "61%" },
        { l: "BEST R", v: "3.2R" },
      ],
      handle: "@giorgos_trades",
      url: "ultimatradingjournal.com",
    },
  },
  workflow: {
    kicker: "How it works",
    title: "From messy history to a clear edge, in 3 steps",
    steps: [
      { n: "01", tone: "ocean", title: "Connect or import", text: "Connect your MT5 account or upload an Excel/CSV export. Your entire history fills in seconds." },
      { n: "02", tone: "gold", title: "See the truth", text: "Live KPIs, equity curve and the P/L calendar show exactly where you make and lose money." },
      { n: "03", tone: "profit", title: "Improve with AI", text: "The Trading and Mindset coaches turn insight into a repeatable, disciplined routine." },
    ],
  },
  pricing: {
    kicker: "Pricing",
    title: "Simple pricing, no surprises",
    subtitle: "Every plan starts with a 7-day free trial. Pay yearly and get two months free.",
    toggle: { monthly: "Monthly", yearly: "Yearly", save: "−17%" },
    plans: [
      {
        id: "monthly",
        name: "MONTHLY",
        price: PLAN_PRICES.monthly,
        per: "/month",
        priceYearly: "€33.33",
        perYearly: "/month · billed yearly",
        wasYearly: PLAN_PRICES.monthly,
        bullets: ["Unlimited trades & accounts", "MT5 Sync & Excel import", "AI Screenshot Scanner", "Full analytics & calendar"],
        featured: false,
        cta: "Start free",
      },
      {
        id: "semiannual",
        name: "6-MONTH",
        price: PLAN_PRICES.semiannual,
        per: "/6 months",
        was: "€239.94",
        saveNote: "1 month free",
        bullets: ["Everything in Monthly", "AI Trading & Mindset Coach", "Prop Firm Tracker (12 firms)", "Daily Pre-Market Briefing"],
        featured: true,
        badge: "MOST POPULAR",
        cta: "Start free",
      },
      {
        id: "annual",
        name: "YEARLY",
        price: PLAN_PRICES.annual,
        per: "/year",
        was: "€479.88",
        saveNote: "2 months free",
        bullets: ["All tools for 12 months", "Two months free", "Priority support", "Early access to new features"],
        featured: false,
        cta: "Start free",
      },
    ],
    footnote: "Secure payment via Stripe · Invoice issued automatically · Cancel in one click",
  },
  faq: {
    kicker: "FAQ",
    title: "Answers to your questions",
    items: [
      ["How does the AI Trading Coach work?", "You upload one or two TradingView screenshots. A vision model reads the setup and returns a 0–100 score, a verdict, your risk:reward and a criterion-by-criterion checklist — then you can ask what to improve."],
      ["Is the Mindset Coach just a chatbot?", "No. It answers strictly from a curated trading-psychology knowledge base, focused on the issues that actually cost money — revenge trading, FOMO, fear and discipline."],
      ["Is my data private and secure?", "Yes. Every trade is tied to your account and encrypted. Other users never see your data, and you can export or delete it whenever you want."],
      ["How does the MT5 connection work?", "Connect your MetaTrader 5 account once and we securely pull your history. New trades sync automatically — no manual entry."],
      ["Is there a free trial?", "Yes. Every plan starts with a 7-day free trial. You can cancel before the trial ends with no charge."],
      ["Is this investment advice?", "No. Ultimate Trading Journal is an analytics and journaling tool for educational purposes. The AI coaches help you reflect on your own trades — they are not investment advice."],
    ],
  },
  finalCta: {
    kicker: "Start today",
    titleA: "Your next 100 trades",
    titleB: "deserve a better journal.",
    subtitle: "Join serious MT5 traders who stopped guessing and started measuring — with an AI coach in their corner.",
    cta: "Start your free trial",
  },
  footer: {
    blurb: "Journal every trade. Master every insight. The professional journal for serious MT5 traders — now with an AI coach.",
    rights: "Ultimate Trading Journal",
    secured: "Secured by Clerk · Payments by Stripe",
  },
};

const el: LandingContent = {
  nav: { coach: "AI Coach", features: "Δυνατότητες", workflow: "Πώς δουλεύει", pricing: "Τιμές", faq: "Συχνές ερωτήσεις" },
  cta: { signIn: "Σύνδεση", start: "Δωρεάν δοκιμή", createAccount: "Δημιουργία λογαριασμού", haveAccount: "Έχω ήδη λογαριασμό" },
  hero: {
    badge: "Φτιαγμένο για σοβαρούς MT5 traders · με AI Coach",
    titleA: "Κάθε trade αφήνει ίχνη.",
    titleHighlight: "Μάθε να τα διαβάζεις.",
    subtitle:
      "Το Ultimate Trading Journal συγχρονίζει το MT5 σου, μετατρέπει το ιστορικό σε καθαρά analytics και εντοπίζει τα μοτίβα που σου κοστίζουν — ενώ ο **AI Coach** σε καθοδηγεί σε στρατηγική και ψυχολογία, **στα ελληνικά**.",
    ctaPrimary: "Ξεκίνα 7 μέρες δωρεάν",
    ctaSecondary: "Γνώρισε τον AI Coach",
    check1: "Χωρίς κάρτα",
    check2: "Σύνδεση MT5 σε 60″",
    check3: "Ακύρωση όποτε θελήσεις",
  },
  heroMock: {
    month: "ΙΟΥΛΙΟΣ 2026",
    acct: "PROP · €50K",
    pl: "+€4.180",
    plLabel: "NET P/L · +8.4%",
    rows: [
      { l: "EURUSD · BUY", v: "+€620", tone: "up" },
      { l: "XAUUSD · SELL", v: "+€1.240", tone: "up" },
      { l: "GBPJPY · BUY", v: "-€310", tone: "down" },
    ],
    winRateLabel: "WIN RATE",
    winRate: "61%",
    pfLabel: "PROFIT FACTOR",
    pf: "1.9",
    coachTitle: "AI TRADING COACH",
    coachMsg:
      "«Το setup σου στο GBPJPY είναι κόντρα στο H4 trend. Στα τελευταία 12 παρόμοια trades είχες 25% επιτυχία — σκέψου το ξανά.»",
    coachTag: "ΑΞΙΟΛΟΓΗΣΗ SETUP: ΟΡΙΑΚΟ 58/100",
    toastLead: "MT5 Sync:",
    toastBold: "14 νέα trades",
    toastTail: "εισήχθησαν",
  },
  stats: [
    { value: "1.100", accent: "+", label: "trades καταγεγραμμένα" },
    { value: "30", accent: "+", label: "ενεργοί traders" },
    { value: "16", label: "εργαλεία σε ένα journal" },
    { value: "12", label: "prop firms στον Tracker" },
    { value: "4.9", accent: "★", label: "αξιολόγηση μελών" },
  ],
  coach: {
    badge: "Ο λόγος που οι traders μένουν",
    title: "Ο προσωπικός σου AI trading & mindset coach",
    subtitle:
      "Τα περισσότερα journals απλώς αποθηκεύουν δεδομένα. Το Ultimate Trading Journal αναλύει τα charts και την ψυχολογία σου — και σου λέει ακριβώς τι να διορθώσεις.",
    tradingTag: "Trading Coach",
    tradingTitle: "Ανέβασε ένα chart. Πάρε βαθμολογημένη, δομημένη ανάλυση.",
    tradingText:
      "Ρίξε ένα ή δύο screenshots από TradingView (π.χ. H1 + H4). Ένα vision model διαβάζει το setup και επιστρέφει βαθμολογία 0–100, ετυμηγορία, το risk:reward σου, ανάγνωση session και πλήρες checklist κριτήριο-προς-κριτήριο — και μετά μπορείς να ρωτήσεις «τι να διορθώσω;».",
    tradingBullets: [
      "Βαθμολογία setup 0–100 με ξεκάθαρη ετυμηγορία",
      "Checklist ανά κριτήριο: τάση, δομή, RR, timing",
      "Αριθμητικό risk:reward και ανάγνωση session/timing",
      "Ρώτα follow-ups στο chat μετά από κάθε ανάλυση",
    ],
    tradingFit: "Κατάλληλο setup",
    tradingNote:
      "Καθαρό break & retest στη ζώνη στήριξης, ευθυγραμμισμένο με την τάση H4. Πρόσεξε το timing εισόδου κοντά στο NY open.",
    tradingChecks: [
      { l: "Ευθυγράμμιση τάσης", s: "ok" },
      { l: "Δομή αγοράς", s: "ok" },
      { l: "Risk : reward ≥ 2", s: "ok" },
      { l: "Timing εισόδου / session", s: "warn" },
      { l: "Τοποθέτηση stop", s: "bad" },
    ],
    statusLabels: { ok: "OK", warn: "ΠΡΟΣΟΧΗ", bad: "ΔΙΟΡΘΩΣΕ" },
    mindsetTag: "Mindset Coach",
    mindsetTitle: "Νίκησε την ψυχολογία που σου κοστίζει χρήματα",
    mindsetText:
      "Revenge trading, FOMO, φόβος, παραβίαση των δικών σου κανόνων — ο Mindset Coach είναι ένας συνομιλιακός coach ψυχολογίας που απαντά από επιμελημένη βάση γνώσης trading-ψυχολογίας, ώστε να χτίσεις σταθερό, πειθαρχημένο μυαλό.",
    mindsetBullets: [
      "Συζήτησε φόβο, ανυπομονησία, πειθαρχία & αμφιβολία",
      "Έτοιμα prompts για να ξεκινήσεις με ένα κλικ",
      "Τεκμηριωμένες απαντήσεις — όχι γενικό chatbot",
    ],
    mindsetUserMsg: "Κάνω συνέχεια revenge-trading μετά από loss. Πώς το σταματάω;",
    mindsetReply:
      "Το revenge trading είναι ο εγκέφαλός σου που προσπαθεί να «κερδίσει πίσω» το loss συναισθηματικά. Βάλε αυστηρό κανόνα: μετά από ένα loss, απομακρύνσου για 15 λεπτά και κατάγραψε πώς νιώθεις εδώ πρώτα. Η παύση σπάει τον φαύλο κύκλο.",
    mindsetPrompts: ["Φοβάμαι να πατήσω το κουμπί", "Κάνω overtrade όταν βαριέμαι"],
    mindsetInput: "Ρώτα τον mindset coach…",
  },
  moreAi: {
    kicker: "Και υπάρχει κι άλλο AI",
    title: "Μπες σε κάθε session προετοιμασμένος",
    briefing: {
      title: "Pre-Market Briefing",
      time: "07:00",
      sentimentLabel: "Sentiment:",
      sentimentText: "Risk-on · DXY πιο αδύναμο πριν το CPI.",
      impactLabel: "HIGH IMPACT ΣΗΜΕΡΑ",
      impactValue: "13:30 UTC · USD CPI",
    },
    news: {
      title: "Market News",
      filter: "High only",
      rows: [
        { c: "USD", t: "CPI m/m", i: "HIGH" },
        { c: "EUR", t: "Ομιλία ΕΚΤ", i: "MED" },
        { c: "GBP", t: "GDP q/q", i: "HIGH" },
      ],
    },
    patterns: {
      title: "Pattern Analysis",
      range: "30 ημέρες",
      rows: [
        { l: "Καλύτερη μέρα", v: "Πέμπτη · 71% WR", tone: "up" },
        { l: "Χειρότερη ώρα", v: "09:00–10:00", tone: "down" },
        { l: "Κορυφαίο ζεύγος", v: "XAUUSD · +€2.1K", tone: "plain" },
      ],
    },
  },
  calendar: {
    kicker: "Το journal",
    title: "Δες τον μήνα σου με μια ματιά",
    text:
      "Το ημερολόγιο P/L μετατρέπει τον μήνα σου σε heatmap — πράσινες μέρες, κόκκινες μέρες και τα μοτίβα από πίσω. Κάνε κλικ σε οποιαδήποτε μέρα για να δεις τα trades που την έφτιαξαν.",
    bullets: [
      "Ημερήσιο heatmap P/L με μετρητές win/loss",
      "KPIs ανά μήνα, equity curve & drawdown",
      "Drag-and-drop εισαγωγή Excel για ολόκληρο μήνα",
    ],
    shotTitle: "Ιούλιος · Ημερολόγιο P/L",
    shotLegend: "Πράσινο = κέρδος · κόκκινο = ζημία",
  },
  features: {
    kicker: "Όλα σε ένα",
    title: "16 εργαλεία. Ένα journal.",
    subtitle: "Ό,τι χρειάζεται ο σοβαρός trader — από την καταγραφή μέχρι τον AI προπονητή — κάτω από την ίδια στέγη.",
    items: [
      { icon: "Plus", tone: "blue", title: "Add Trade", text: "Καταγραφή με screenshot scan και πλήρεις σημειώσεις" },
      { icon: "RefreshCw", tone: "tealA", title: "Sync MT5", text: "Αυτόματος συγχρονισμός trades από τον MetaTrader σου" },
      { icon: "CalendarPlus", tone: "sky", title: "New Month", text: "Νέος μήνας με αρχικό κεφάλαιο και καθαρό snapshot" },
      { icon: "ListChecks", tone: "mint", title: "Pre-Trade Check", text: "Λίστα 20 σημείων πριν από κάθε είσοδο" },
      { icon: "Wallet", tone: "peach", title: "Cash Adjustment", text: "Καταθέσεις & αναλήψεις στον τρέχοντα λογαριασμό" },
      { icon: "TrendingUp", tone: "pink", title: "Compounding", text: "Προβολές ανατοκισμού και σενάρια ρίσκου" },
      { icon: "FileSpreadsheet", tone: "slate", title: "Export Excel", text: "Ο μήνας σου σε workbook με ένα κλικ" },
      { icon: "LayoutGrid", tone: "steel", title: "Accounts Overview", text: "Όλοι οι λογαριασμοί σου με μια ματιά" },
      { icon: "CalendarDays", tone: "green", title: "Calendar", text: "Ημερολογιακή απεικόνιση των trades σου" },
      { icon: "Calculator", tone: "indigo", title: "Position Calculator", text: "Μέγεθος θέσης βάσει κεφαλαίου και ρίσκου %" },
      { icon: "PieChart", tone: "violet", title: "Pattern Analysis", text: "Win rate ανά ημέρα, ώρα, ζεύγος & setup" },
      { icon: "Brain", tone: "coralA", title: "Mindset Coach", text: "Ψυχολογική υποστήριξη και προπόνηση νοοτροπίας" },
      { icon: "LineChart", tone: "oceanTeal", title: "Trading Coach", text: "Ο AI αξιολογεί τα setups σου βάσει της στρατηγικής σου" },
      { icon: "Sun", tone: "amber", title: "Pre-Market Briefing", text: "Καθημερινή AI ενημέρωση με sentiment & bias" },
      { icon: "Newspaper", tone: "cyan", title: "Market News", text: "Οικονομικό ημερολόγιο με γεγονότα υψηλής σημασίας" },
      { icon: "Shield", tone: "forest", title: "Prop Firm Tracker", text: "Μείνε 100% εντός κανόνων του funded λογαριασμού σου" },
    ],
  },
  testimonials: {
    kicker: "Οι traders μας",
    title: "Αποτελέσματα που μιλούν μόνα τους",
    spotlight: {
      pre: "Πέρασα το FTMO challenge με τη δεύτερη προσπάθεια. Η διαφορά; Επιτέλους ",
      hl: "έβλεπα τα μοτίβα μου",
      post: " — το Pattern Analysis μού έδειξε ότι οι περισσότερες ζημιές μου ήταν Δευτέρα πρωί. Σταμάτησα να τραιδάρω Δευτέρες. Αυτό ήταν.",
      initials: "ΓΚ",
      name: "Γιώργος Κ.",
      role: "Funded trader · FTMO 100K",
    },
    minis: [
      { quote: "Ο Mindset Coach με κράτησε δύο φορές από revenge trade μέσα στην ίδια εβδομάδα. Αξίζει όσο δέκα συνδρομές.", name: "Μαρία Π. · Swing trader" },
      { quote: "Σύνδεσα το MT5 σε ένα λεπτό και όλα μπήκαν μόνα τους. Δεν ανοίγω ξανά Excel.", name: "Δημήτρης Σ. · Prop trader" },
      { quote: "Το πρωινό Pre-Market Briefing έγινε κομμάτι της ρουτίνας μου, όπως ο καφές.", name: "Νίκος Α. · Day trader" },
    ],
  },
  share: {
    kicker: "Μοιράσου την πρόοδό σου",
    title: "Ο καλός μήνας σου, σε μία κάρτα",
    heading: "Με ένα κλικ, τα στατιστικά του μήνα γίνονται κάρτα έτοιμη για κοινοποίηση.",
    text:
      "Δημόσιο, read-only στιγμιότυπο με τα νούμερα που εσύ επιλέγεις — ιδανικό για Instagram stories, Telegram groups και Discord. Χωρίς ποσά λογαριασμού, χωρίς ευαίσθητα στοιχεία.",
    bullets: [
      "Branded σύνδεσμος ultimatradingjournal.com/share/…",
      "Εσύ αποφασίζεις τι φαίνεται και για πόσο",
      "Η καλύτερη διαφήμιση του trading σου — και του journal",
    ],
    card: {
      brand: "ULTIMATE TJ",
      month: "ΙΟΥΛΙΟΣ 2026 · PROP",
      big: "+€4.180",
      pct: "+8.4%",
      stats: [
        { l: "TRADES", v: "42" },
        { l: "WIN RATE", v: "61%" },
        { l: "BEST R", v: "3.2R" },
      ],
      handle: "@giorgos_trades",
      url: "ultimatradingjournal.com",
    },
  },
  workflow: {
    kicker: "Πώς δουλεύει",
    title: "Από μπερδεμένο ιστορικό σε ξεκάθαρο edge, σε 3 βήματα",
    steps: [
      { n: "01", tone: "ocean", title: "Σύνδεσε ή εισήγαγε", text: "Σύνδεσε τον MT5 λογαριασμό σου ή ανέβασε ένα Excel/CSV export. Όλο το ιστορικό σου γεμίζει σε δευτερόλεπτα." },
      { n: "02", tone: "gold", title: "Δες την αλήθεια", text: "Ζωντανά KPIs, equity curve και ημερολόγιο P/L δείχνουν ακριβώς πού κερδίζεις και πού χάνεις χρήματα." },
      { n: "03", tone: "profit", title: "Βελτιώσου με AI", text: "Ο Trading και ο Mindset coach μετατρέπουν την πληροφορία σε επαναλαμβανόμενη, πειθαρχημένη ρουτίνα." },
    ],
  },
  pricing: {
    kicker: "Τιμές",
    title: "Καθαρή τιμολόγηση, χωρίς εκπλήξεις",
    subtitle: "Όλα τα πλάνα ξεκινούν με 7ήμερη δωρεάν δοκιμή. Με την ετήσια χρέωση κερδίζεις δύο μήνες.",
    toggle: { monthly: "Μηνιαία", yearly: "Ετήσια", save: "−17%" },
    plans: [
      {
        id: "monthly",
        name: "MONTHLY",
        price: PLAN_PRICES.monthly,
        per: "/μήνα",
        priceYearly: "€33.33",
        perYearly: "/μήνα · ετήσια χρέωση",
        wasYearly: PLAN_PRICES.monthly,
        bullets: ["Απεριόριστα trades & λογαριασμοί", "Sync MT5 & Import Excel", "AI Screenshot Scanner", "Πλήρη analytics & ημερολόγιο"],
        featured: false,
        cta: "Ξεκίνα δωρεάν",
      },
      {
        id: "semiannual",
        name: "6-MONTH",
        price: PLAN_PRICES.semiannual,
        per: "/6μηνο",
        was: "€239.94",
        saveNote: "1 μήνας δωρεάν",
        bullets: ["Ό,τι περιλαμβάνει το Monthly", "AI Trading & Mindset Coach", "Prop Firm Tracker (12 firms)", "Καθημερινό Pre-Market Briefing"],
        featured: true,
        badge: "Η ΕΠΙΛΟΓΗ ΤΩΝ ΜΕΛΩΝ",
        cta: "Ξεκίνα δωρεάν",
      },
      {
        id: "annual",
        name: "YEARLY",
        price: PLAN_PRICES.annual,
        per: "/έτος",
        was: "€479.88",
        saveNote: "2 μήνες δωρεάν",
        bullets: ["Όλα τα εργαλεία για 12 μήνες", "Δύο μήνες δώρο", "Προτεραιότητα στην υποστήριξη", "Πρώτος στα νέα features"],
        featured: false,
        cta: "Ξεκίνα δωρεάν",
      },
    ],
    footnote: "Ασφαλής πληρωμή μέσω Stripe · Παραστατικό αυτόματα · Ακύρωση με ένα κλικ",
  },
  faq: {
    kicker: "Συχνές ερωτήσεις",
    title: "Απαντήσεις στις ερωτήσεις σου",
    items: [
      ["Πώς δουλεύει ο AI Trading Coach;", "Ανεβάζεις ένα ή δύο screenshots από TradingView. Ένα vision model διαβάζει το setup και επιστρέφει βαθμολογία 0–100, ετυμηγορία, το risk:reward σου και checklist κριτήριο-προς-κριτήριο — και μετά μπορείς να ρωτήσεις τι να βελτιώσεις."],
      ["Ο Mindset Coach είναι ένα απλό chatbot;", "Όχι. Απαντά αυστηρά από επιμελημένη βάση γνώσης trading-ψυχολογίας, εστιασμένη στα θέματα που πραγματικά κοστίζουν χρήματα — revenge trading, FOMO, φόβο και πειθαρχία."],
      ["Είναι ιδιωτικά και ασφαλή τα δεδομένα μου;", "Ναι. Κάθε trade είναι δεμένο στον λογαριασμό σου και κρυπτογραφημένο. Οι άλλοι χρήστες δεν βλέπουν ποτέ τα δεδομένα σου, και μπορείς να τα εξάγεις ή να τα διαγράψεις όποτε θες."],
      ["Πώς γίνεται η σύνδεση με MT5;", "Σύνδεσε μία φορά τον MetaTrader 5 λογαριασμό σου και τραβάμε με ασφάλεια το ιστορικό σου. Τα νέα trades συγχρονίζονται αυτόματα — χωρίς χειροκίνητη καταχώρηση."],
      ["Υπάρχει δωρεάν δοκιμή;", "Ναι. Κάθε πλάνο ξεκινά με 7 ημέρες δωρεάν δοκιμή. Μπορείς να ακυρώσεις πριν λήξει η δοκιμή χωρίς χρέωση."],
      ["Είναι επενδυτική συμβουλή;", "Όχι. Το Ultimate Trading Journal είναι εργαλείο analytics και journaling για εκπαιδευτικούς σκοπούς. Οι AI coaches σε βοηθούν να αναλογιστείς τα δικά σου trades — δεν αποτελούν επενδυτική συμβουλή."],
    ],
  },
  finalCta: {
    kicker: "Ξεκίνα σήμερα",
    titleA: "Τα επόμενα 100 trades σου",
    titleB: "αξίζουν ένα καλύτερο journal.",
    subtitle: "Ένωσε δυνάμεις με σοβαρούς MT5 traders που σταμάτησαν να μαντεύουν και άρχισαν να μετρούν — με έναν AI coach στη γωνία τους.",
    cta: "Ξεκίνα τη δοκιμή",
  },
  footer: {
    blurb: "Κατέγραψε κάθε trade. Κατάκτησε κάθε insight. Το επαγγελματικό journal για σοβαρούς MT5 traders — τώρα με AI coach.",
    rights: "Ultimate Trading Journal",
    secured: "Secured by Clerk · Payments by Stripe",
  },
};

export const LANDING_CONTENT: Record<Lang, LandingContent> = { en, el };
