// Full landing-page content in English (default) and Greek. Core trading terms
// (equity curve, win rate, profit factor, R-multiple, drawdown, RR, session,
// MT5, etc.) are kept in English in BOTH languages by design.
import type { Lang } from "@/contexts/LanguageContext";

export interface Feature {
  icon: string; // icon key resolved in Landing.tsx
  tone: string;
  title: string;
  text: string;
  badge?: string;
}

export interface LandingContent {
  nav: { coach: string; features: string; workflow: string; pricing: string; faq: string };
  cta: { signIn: string; start: string; createAccount: string; haveAccount: string };
  hero: {
    badge: string;
    titleA: string;
    titleHighlight: string;
    titleB: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    check1: string;
    check2: string;
    check3: string;
    shotRecent: string;
    shotEquity: string;
  };
  statsCaption: string;
  stats: Array<{ value: string; label: string }>;
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
    mindsetTag: string;
    mindsetTitle: string;
    mindsetText: string;
    mindsetBullets: string[];
    mindsetMe: string;
    mindsetUserMsg: string;
    mindsetReply: string;
    mindsetPrompts: string[];
    mindsetInput: string;
  };
  moreAi: { kicker: string; title: string };
  calendar: {
    kicker: string;
    title: string;
    text: string;
    bullets: string[];
    shotTitle: string;
    shotLegend: string;
  };
  features: { kicker: string; title: string; subtitle: string; items: Feature[] };
  workflow: { kicker: string; title: string; steps: Array<{ n: string; tone: string; title: string; text: string }> };
  pricing: {
    kicker: string;
    title: string;
    subtitle: string;
    includes: string[];
    plans: Array<{ id: string; name: string; price: string; per: string; blurb: string; featured: boolean; badge?: string; cta: string }>;
    footnote: string;
  };
  faq: { kicker: string; title: string; items: Array<[string, string]> };
  finalCta: { title: string; subtitle: string };
  footer: { blurb: string; product: string; account: string; rights: string; secured: string };
}

const PLAN_PRICES = { monthly: "€39.99", semiannual: "€199.99", annual: "€399.99" };

const en: LandingContent = {
  nav: { coach: "AI Coach", features: "Features", workflow: "How it works", pricing: "Pricing", faq: "FAQ" },
  cta: { signIn: "Sign in", start: "Get started", createAccount: "Create account", haveAccount: "I already have an account" },
  hero: {
    badge: "Built for serious MT5 traders · now with an AI coach",
    titleA: "Journal every trade.",
    titleHighlight: "Master",
    titleB: "every insight.",
    subtitle:
      "The professional trading journal that turns your MT5 history into clean analytics — plus an AI trading coach and mindset coach that help you fix your strategy and your psychology.",
    ctaPrimary: "Create account",
    ctaSecondary: "Meet the AI coach",
    check1: "7-day free trial",
    check2: "Connect MT5 in 60 seconds",
    check3: "Private by default",
    shotRecent: "Recent trades",
    shotEquity: "Equity curve · range",
  },
  statsCaption: "Everything a disciplined trader needs, in one place",
  stats: [
    { value: "60''", label: "MT5 connection" },
    { value: "13+", label: "Professional tools" },
    { value: "4", label: "AI-powered tools" },
    { value: "100%", label: "Private & encrypted" },
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
    mindsetTag: "Mindset Coach",
    mindsetTitle: "Beat the psychology that costs you money",
    mindsetText:
      "Revenge trading, FOMO, fear, breaking your own rules — the Mindset Coach is a conversational psychology coach that answers from a curated trading-psychology knowledge base, so you build a steady, disciplined mind.",
    mindsetBullets: [
      "Talk through fear, impatience, discipline & doubt",
      "Ready-made prompts to start with one click",
      "Grounded answers — not a generic chatbot",
    ],
    mindsetMe: "Me",
    mindsetUserMsg: "I keep revenge-trading after a loss. How do I stop?",
    mindsetReply:
      "Revenge trading is your brain trying to “win back” the loss emotionally. Set a hard rule: after a loss, step away for 15 minutes and journal how you feel here first. The pause breaks the loop.",
    mindsetPrompts: ["I'm scared to pull the trigger", "I overtrade when I'm bored"],
    mindsetInput: "Ask the mindset coach…",
  },
  moreAi: { kicker: "And there's more AI", title: "Walk into every session prepared" },
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
    shotTitle: "June · P/L Calendar",
    shotLegend: "Green = profit · red = loss",
  },
  features: {
    kicker: "The complete toolkit",
    title: "Everything in one journal",
    subtitle:
      "Stop juggling spreadsheets and screenshots. Every tool a serious trader needs, in one private workspace.",
    items: [
      { icon: "BarChart3", tone: "ocean", title: "Professional Dashboard", text: "Equity curve, win rate, profit factor, R-multiples and max drawdown — live with every trade. View a single month, a range of months or the overall total." },
      { icon: "Activity", tone: "profit", title: "AI Trading Coach", text: "Upload screenshots of your charts and get a scored, structured review with a checklist of fixes.", badge: "AI" },
      { icon: "Brain", tone: "violet", title: "AI Mindset Coach", text: "A conversational psychology coach for revenge trading, FOMO, fear and discipline.", badge: "AI" },
      { icon: "Sun", tone: "gold", title: "Pre-Market Briefing", text: "Daily AI briefing: sentiment, high-impact events, pairs to watch and a bias table.", badge: "AI" },
      { icon: "Newspaper", tone: "ocean", title: "Market News", text: "High-impact economic calendar, filtered and adjusted to your time zone." },
      { icon: "PieChart", tone: "violet", title: "Pattern Analysis", text: "Deterministic analytics + AI narration that surfaces your recurring profitable setups.", badge: "AI" },
      { icon: "RefreshCw", tone: "profit", title: "One-click MT5 connection", text: "Connect MetaTrader 5 and pull your full history automatically. No manual entry." },
      { icon: "CalendarDays", tone: "gold", title: "P/L Calendar", text: "A monthly heatmap of green and red days, with click-through drill-down into each day's trades." },
      { icon: "FileSpreadsheet", tone: "ocean", title: "Import & Export Excel", text: "Import Excel/CSV to fill a whole month — and export whenever you want. Your data stays yours." },
      { icon: "Calculator", tone: "profit", title: "Position Calculator", text: "Size every trade correctly with a built-in risk & position-size calculator." },
      { icon: "Wallet", tone: "gold", title: "Cash Movement & Compounding", text: "Log deposits/withdrawals and track how your capital grows over time." },
      { icon: "ShieldCheck", tone: "loss", title: "Private by default", text: "Every trade is tied to your account and encrypted. No one else sees your data." },
    ],
  },
  workflow: {
    kicker: "How it works",
    title: "From messy history to a clear edge in 3 steps",
    steps: [
      { n: "01", tone: "ocean", title: "Connect or import", text: "Connect your MT5 account or upload an Excel/CSV export. Your full history fills in within seconds." },
      { n: "02", tone: "gold", title: "See the truth", text: "Live KPIs, equity curve and a P/L calendar show exactly where you make and lose money." },
      { n: "03", tone: "profit", title: "Improve with AI", text: "The Trading and Mindset coaches turn insight into a repeatable, disciplined routine." },
    ],
  },
  pricing: {
    kicker: "Pricing",
    title: "Start with a 7-day free trial. Cancel anytime.",
    subtitle: "One avoided loss covers months of subscription. Every plan includes every feature.",
    includes: [
      "All analytics & equity curve",
      "Automatic MT5 sync & Excel import/export",
      "AI Trading Coach & Mindset Coach",
      "Pre-Market Briefing & Market News",
      "Pattern Analysis & Position Calculator",
      "Unlimited accounts & share cards",
    ],
    plans: [
      { id: "monthly", name: "Monthly", price: PLAN_PRICES.monthly, per: "/ month", blurb: "Full access, billed monthly. Cancel anytime.", featured: false, cta: "Start 7-day free trial" },
      { id: "semiannual", name: "6 months", price: PLAN_PRICES.semiannual, per: "/ 6 months", blurb: "≈ €33.33/month — one month free vs monthly.", featured: true, badge: "1 month free", cta: "Start 7-day free trial" },
      { id: "annual", name: "Annual", price: PLAN_PRICES.annual, per: "/ year", blurb: "≈ €33.33/month — two months free vs monthly.", featured: false, badge: "2 months free", cta: "Start 7-day free trial" },
    ],
    footnote: "All plans start with a 7-day free trial · Payments by Stripe",
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
    title: "Your next 100 trades deserve a better journal.",
    subtitle: "Join serious MT5 traders who stopped guessing and started measuring — with an AI coach in their corner.",
  },
  footer: {
    blurb: "Journal every trade. Master every insight. The professional journal for serious MT5 traders — now with an AI coach.",
    product: "Product",
    account: "Account",
    rights: "Ultimate Trading Journal",
    secured: "Secured by Clerk · Payments by Stripe",
  },
};

const el: LandingContent = {
  nav: { coach: "AI Coach", features: "Δυνατότητες", workflow: "Πώς δουλεύει", pricing: "Τιμές", faq: "Συχνές ερωτήσεις" },
  cta: { signIn: "Σύνδεση", start: "Ξεκίνα", createAccount: "Δημιουργία λογαριασμού", haveAccount: "Έχω ήδη λογαριασμό" },
  hero: {
    badge: "Φτιαγμένο για σοβαρούς MT5 traders · τώρα με AI coach",
    titleA: "Κατέγραψε κάθε trade.",
    titleHighlight: "Κατάκτησε",
    titleB: "κάθε insight.",
    subtitle:
      "Το επαγγελματικό trading journal που μετατρέπει το ιστορικό σου από τον MT5 σε καθαρά analytics — μαζί με έναν AI trading coach και mindset coach που σε βοηθούν να διορθώσεις τη στρατηγική και την ψυχολογία σου.",
    ctaPrimary: "Δημιούργησε λογαριασμό",
    ctaSecondary: "Γνώρισε τον AI coach",
    check1: "7 ημέρες δωρεάν δοκιμή",
    check2: "Σύνδεση MT5 σε 60 δευτερόλεπτα",
    check3: "Ιδιωτικό από προεπιλογή",
    shotRecent: "Πρόσφατα trades",
    shotEquity: "Equity curve · εύρος",
  },
  statsCaption: "Ό,τι χρειάζεται ένας πειθαρχημένος trader σε ένα μέρος",
  stats: [
    { value: "60''", label: "Σύνδεση MT5" },
    { value: "13+", label: "Επαγγελματικά εργαλεία" },
    { value: "4", label: "Εργαλεία με AI" },
    { value: "100%", label: "Ιδιωτικά & κρυπτογραφημένα" },
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
    mindsetTag: "Mindset Coach",
    mindsetTitle: "Νίκησε την ψυχολογία που σου κοστίζει χρήματα",
    mindsetText:
      "Revenge trading, FOMO, φόβος, παραβίαση των δικών σου κανόνων — ο Mindset Coach είναι ένας συνομιλιακός coach ψυχολογίας που απαντά από επιμελημένη βάση γνώσης trading-ψυχολογίας, ώστε να χτίσεις σταθερό, πειθαρχημένο μυαλό.",
    mindsetBullets: [
      "Συζήτησε φόβο, ανυπομονησία, πειθαρχία & αμφιβολία",
      "Έτοιμα prompts για να ξεκινήσεις με ένα κλικ",
      "Τεκμηριωμένες απαντήσεις — όχι γενικό chatbot",
    ],
    mindsetMe: "Εγώ",
    mindsetUserMsg: "Κάνω συνέχεια revenge-trading μετά από loss. Πώς το σταματάω;",
    mindsetReply:
      "Το revenge trading είναι ο εγκέφαλός σου που προσπαθεί να «κερδίσει πίσω» το loss συναισθηματικά. Βάλε αυστηρό κανόνα: μετά από ένα loss, απομακρύνσου για 15 λεπτά και κατάγραψε πώς νιώθεις εδώ πρώτα. Η παύση σπάει τον φαύλο κύκλο.",
    mindsetPrompts: ["Φοβάμαι να πατήσω το κουμπί", "Κάνω overtrade όταν βαριέμαι"],
    mindsetInput: "Ρώτα τον mindset coach…",
  },
  moreAi: { kicker: "Και υπάρχει κι άλλο AI", title: "Μπες σε κάθε session προετοιμασμένος" },
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
    shotTitle: "Ιούνιος · Ημερολόγιο P/L",
    shotLegend: "Πράσινο = κέρδος · κόκκινο = ζημία",
  },
  features: {
    kicker: "Η πλήρης εργαλειοθήκη",
    title: "Όλα σε ένα journal",
    subtitle:
      "Σταμάτα να ζογκλάρεις spreadsheets και screenshots. Κάθε εργαλείο που χρειάζεται ένας σοβαρός trader, σε έναν ιδιωτικό χώρο εργασίας.",
    items: [
      { icon: "BarChart3", tone: "ocean", title: "Επαγγελματικό Dashboard", text: "Equity curve, win rate, profit factor, R-multiples και max drawdown — ζωντανά με κάθε trade. Δες έναν μήνα, εύρος μηνών ή τα συνολικά." },
      { icon: "Activity", tone: "profit", title: "AI Trading Coach", text: "Ανέβασε screenshots από τα charts σου και πάρε βαθμολογημένη, δομημένη ανάλυση με checklist διορθώσεων.", badge: "AI" },
      { icon: "Brain", tone: "violet", title: "AI Mindset Coach", text: "Συνομιλιακός coach ψυχολογίας για revenge trading, FOMO, φόβο και πειθαρχία.", badge: "AI" },
      { icon: "Sun", tone: "gold", title: "Pre-Market Briefing", text: "Καθημερινό AI briefing: sentiment, γεγονότα υψηλής επίδρασης, ζευγάρια προς παρακολούθηση και πίνακας bias.", badge: "AI" },
      { icon: "Newspaper", tone: "ocean", title: "Market News", text: "Οικονομικό ημερολόγιο υψηλής επίδρασης, φιλτραρισμένο και προσαρμοσμένο στη ζώνη ώρας σου." },
      { icon: "PieChart", tone: "violet", title: "Pattern Analysis", text: "Ντετερμινιστικά analytics + AI αφήγηση που αναδεικνύει τα επαναλαμβανόμενα κερδοφόρα setups σου.", badge: "AI" },
      { icon: "RefreshCw", tone: "profit", title: "Σύνδεση MT5 με ένα κλικ", text: "Σύνδεσε τον MetaTrader 5 και τράβα όλο το ιστορικό σου αυτόματα. Χωρίς χειροκίνητη καταχώρηση." },
      { icon: "CalendarDays", tone: "gold", title: "Ημερολόγιο P/L", text: "Μηνιαίο heatmap από πράσινες και κόκκινες μέρες, με κλικ για drill-down στα trades κάθε μέρας." },
      { icon: "FileSpreadsheet", tone: "ocean", title: "Import & Export Excel", text: "Εισαγωγή Excel/CSV για να γεμίσεις έναν ολόκληρο μήνα — και εξαγωγή όποτε θες. Τα δεδομένα μένουν δικά σου." },
      { icon: "Calculator", tone: "profit", title: "Position Calculator", text: "Υπολόγισε σωστά το μέγεθος κάθε trade με ενσωματωμένο calculator ρίσκου & position size." },
      { icon: "Wallet", tone: "gold", title: "Cash Movement & Compounding", text: "Κατέγραψε καταθέσεις/αναλήψεις και παρακολούθησε την ανάπτυξη του κεφαλαίου σου διαχρονικά." },
      { icon: "ShieldCheck", tone: "loss", title: "Ιδιωτικό από προεπιλογή", text: "Κάθε trade είναι δεμένο στον λογαριασμό σου και κρυπτογραφημένο. Κανείς άλλος δεν βλέπει τα δεδομένα σου." },
    ],
  },
  workflow: {
    kicker: "Πώς δουλεύει",
    title: "Από μπερδεμένο ιστορικό σε ξεκάθαρο edge σε 3 βήματα",
    steps: [
      { n: "01", tone: "ocean", title: "Σύνδεσε ή εισήγαγε", text: "Σύνδεσε τον MT5 λογαριασμό σου ή ανέβασε ένα Excel/CSV export. Όλο το ιστορικό σου γεμίζει σε δευτερόλεπτα." },
      { n: "02", tone: "gold", title: "Δες την αλήθεια", text: "Ζωντανά KPIs, equity curve και ημερολόγιο P/L δείχνουν ακριβώς πού κερδίζεις και πού χάνεις χρήματα." },
      { n: "03", tone: "profit", title: "Βελτιώσου με AI", text: "Ο Trading και ο Mindset coach μετατρέπουν την πληροφορία σε επαναλαμβανόμενη, πειθαρχημένη ρουτίνα." },
    ],
  },
  pricing: {
    kicker: "Τιμές",
    title: "Ξεκίνα με 7 ημέρες δωρεάν. Ακύρωση όποτε θες.",
    subtitle: "Ένα loss που αποφεύγεις καλύπτει μήνες συνδρομής. Όλα τα πλάνα περιλαμβάνουν κάθε δυνατότητα.",
    includes: [
      "Όλα τα analytics & equity curve",
      "Αυτόματο sync MT5 & import/export Excel",
      "AI Trading Coach & Mindset Coach",
      "Pre-Market Briefing & Market News",
      "Pattern Analysis & Position Calculator",
      "Απεριόριστοι λογαριασμοί & share cards",
    ],
    plans: [
      { id: "monthly", name: "Μηνιαίο", price: PLAN_PRICES.monthly, per: "/ μήνα", blurb: "Πλήρης πρόσβαση, μηνιαία χρέωση. Ακύρωση όποτε θες.", featured: false, cta: "Ξεκίνα 7 ημέρες δωρεάν" },
      { id: "semiannual", name: "Εξάμηνο", price: PLAN_PRICES.semiannual, per: "/ 6 μήνες", blurb: "≈ €33,33/μήνα — ένας μήνας δωρεάν σε σχέση με το μηνιαίο.", featured: true, badge: "1 μήνας δωρεάν", cta: "Ξεκίνα 7 ημέρες δωρεάν" },
      { id: "annual", name: "Ετήσιο", price: PLAN_PRICES.annual, per: "/ έτος", blurb: "≈ €33,33/μήνα — δύο μήνες δωρεάν σε σχέση με το μηνιαίο.", featured: false, badge: "2 μήνες δωρεάν", cta: "Ξεκίνα 7 ημέρες δωρεάν" },
    ],
    footnote: "Όλα τα πλάνα ξεκινούν με 7 ημέρες δωρεάν δοκιμή · Πληρωμές μέσω Stripe",
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
    title: "Τα επόμενα 100 trades σου αξίζουν ένα καλύτερο journal.",
    subtitle: "Ένωσε δυνάμεις με σοβαρούς MT5 traders που σταμάτησαν να μαντεύουν και άρχισαν να μετρούν — με έναν AI coach στη γωνία τους.",
  },
  footer: {
    blurb: "Κατέγραψε κάθε trade. Κατάκτησε κάθε insight. Το επαγγελματικό journal για σοβαρούς MT5 traders — τώρα με AI coach.",
    product: "Προϊόν",
    account: "Λογαριασμός",
    rights: "Ultimate Trading Journal",
    secured: "Secured by Clerk · Payments by Stripe",
  },
};

export const LANDING_CONTENT: Record<Lang, LandingContent> = { en, el };
