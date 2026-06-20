// Public marketing landing page shown to signed-out visitors (Clerk active).
// Ocean Depth Premium design language. Greek copy, real product features and
// real Stripe pricing. Funnels visitors to Clerk SignIn / SignUp modals.

import React from "react";
import { SignInButton, SignUpButton } from "@clerk/clerk-react";
import { useEffect, useRef } from "react";
void React;
import {
  ArrowRight,
  BarChart3,
  Brain,
  CalendarDays,
  Check,
  Minus,
  X,
  RefreshCw,
  FileSpreadsheet,
  Wallet,
  ShieldCheck,
  Calculator,
  PieChart,
  Newspaper,
  Sun,
  Activity,
  Layers,
  Sparkles,
  Send,
  Mic,
} from "lucide-react";

const LOGO =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663576082454/8kEKtsKWxF9JiwbjRbrvBM/utj-logo-badge-N5NDtvx9GcDyhxwM7gRvFA.webp";

// ===== Scroll-reveal hook =====
function useScrollReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("lp-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "-60px" },
    );
    document.querySelectorAll(".lp-fade").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// ===== Small UI atoms =====
function BrowserFrame({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-gradient-to-b from-[#0D1E35] to-[#0A1628] shadow-[0_30px_80px_rgba(0,0,0,0.5)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <span className="w-2.5 h-2.5 rounded-full bg-[#E94F37]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#F4A261]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#00C2A0]" />
        <span className="ml-2 font-mono text-[10px] text-[#4A6080] truncate">
          {url}
        </span>
      </div>
      <div className="p-4 text-left">{children}</div>
    </div>
  );
}

// ===== Data =====
const NAV_LINKS = [
  { href: "#coach", label: "AI Coach" },
  { href: "#features", label: "Δυνατότητες" },
  { href: "#workflow", label: "Πώς δουλεύει" },
  { href: "#pricing", label: "Τιμές" },
  { href: "#faq", label: "Συχνές ερωτήσεις" },
];

const STATS = [
  { value: "60''", label: "Σύνδεση MT5" },
  { value: "13+", label: "Επαγγελματικά εργαλεία" },
  { value: "4", label: "Εργαλεία με AI" },
  { value: "100%", label: "Ιδιωτικά & κρυπτογραφημένα" },
];

const FEATURES: Array<{
  icon: React.ReactNode;
  tone: string;
  title: string;
  text: string;
  badge?: string;
}> = [
  {
    icon: <BarChart3 size={20} />,
    tone: "ocean",
    title: "Επαγγελματικό Dashboard",
    text: "Equity curve, win rate, profit factor, R-multiples και max drawdown — ζωντανά με κάθε trade. Δες έναν μήνα, εύρος μηνών ή τα συνολικά.",
  },
  {
    icon: <Activity size={20} />,
    tone: "profit",
    title: "AI Trading Coach",
    text: "Ανέβασε screenshots από τα charts σου και πάρε βαθμολογημένη, δομημένη ανάλυση με checklist διορθώσεων.",
    badge: "AI",
  },
  {
    icon: <Brain size={20} />,
    tone: "violet",
    title: "AI Mindset Coach",
    text: "Συνομιλιακός coach ψυχολογίας για revenge trading, FOMO, φόβο και πειθαρχία.",
    badge: "AI",
  },
  {
    icon: <Sun size={20} />,
    tone: "gold",
    title: "Pre-Market Briefing",
    text: "Καθημερινό AI briefing: sentiment, γεγονότα υψηλής επίδρασης, ζευγάρια προς παρακολούθηση και πίνακας bias.",
    badge: "AI",
  },
  {
    icon: <Newspaper size={20} />,
    tone: "ocean",
    title: "Market News",
    text: "Οικονομικό ημερολόγιο υψηλής επίδρασης, φιλτραρισμένο και προσαρμοσμένο στη ζώνη ώρας σου.",
  },
  {
    icon: <PieChart size={20} />,
    tone: "violet",
    title: "Pattern Analysis",
    text: "Ντετερμινιστικά analytics + AI αφήγηση που αναδεικνύει τα επαναλαμβανόμενα κερδοφόρα setups σου.",
    badge: "AI",
  },
  {
    icon: <RefreshCw size={20} />,
    tone: "profit",
    title: "Σύνδεση MT5 με ένα κλικ",
    text: "Σύνδεσε τον MetaTrader 5 και τράβα όλο το ιστορικό σου αυτόματα. Χωρίς χειροκίνητη καταχώρηση.",
  },
  {
    icon: <CalendarDays size={20} />,
    tone: "gold",
    title: "Ημερολόγιο P/L",
    text: "Μηνιαίο heatmap από πράσινες και κόκκινες μέρες, με κλικ για drill-down στα trades κάθε μέρας.",
  },
  {
    icon: <FileSpreadsheet size={20} />,
    tone: "ocean",
    title: "Import & Export Excel",
    text: "Εισαγωγή Excel/CSV για να γεμίσεις έναν ολόκληρο μήνα — και εξαγωγή όποτε θες. Τα δεδομένα μένουν δικά σου.",
  },
  {
    icon: <Calculator size={20} />,
    tone: "profit",
    title: "Position Calculator",
    text: "Υπολόγισε σωστά το μέγεθος κάθε trade με ενσωματωμένο calculator ρίσκου & position size.",
  },
  {
    icon: <Wallet size={20} />,
    tone: "gold",
    title: "Cash Movement & Compounding",
    text: "Κατέγραψε καταθέσεις/αναλήψεις και παρακολούθησε την ανάπτυξη του κεφαλαίου σου διαχρονικά.",
  },
  {
    icon: <ShieldCheck size={20} />,
    tone: "loss",
    title: "Ιδιωτικό από προεπιλογή",
    text: "Κάθε trade είναι δεμένο στον λογαριασμό σου και κρυπτογραφημένο. Κανείς άλλος δεν βλέπει τα δεδομένα σου.",
  },
];

const TONE_MAP: Record<string, string> = {
  ocean: "bg-[#0094C6]/15 text-[#00B4D8]",
  gold: "bg-[#F4A261]/15 text-[#F4A261]",
  profit: "bg-[#00C2A0]/15 text-[#00C2A0]",
  violet: "bg-[#9B7BE0]/15 text-[#9B7BE0]",
  loss: "bg-[#E94F37]/15 text-[#E94F37]",
};

const WORKFLOW = [
  {
    n: "01",
    tone: "ocean",
    title: "Σύνδεσε ή εισήγαγε",
    text: "Σύνδεσε τον MT5 λογαριασμό σου ή ανέβασε ένα Excel/CSV export. Όλο το ιστορικό σου γεμίζει σε δευτερόλεπτα.",
  },
  {
    n: "02",
    tone: "gold",
    title: "Δες την αλήθεια",
    text: "Ζωντανά KPIs, equity curve και ημερολόγιο P/L δείχνουν ακριβώς πού κερδίζεις και πού χάνεις χρήματα.",
  },
  {
    n: "03",
    tone: "profit",
    title: "Βελτιώσου με AI",
    text: "Ο Trading και ο Mindset coach μετατρέπουν την πληροφορία σε επαναλαμβανόμενη, πειθαρχημένη ρουτίνα.",
  },
];

const PLANS = [
  {
    id: "monthly",
    name: "Μηνιαίο",
    price: "€39.99",
    per: "/ μήνα",
    blurb: "Πλήρης πρόσβαση, μηνιαία χρέωση. Ακύρωση όποτε θες.",
    featured: false,
    badge: undefined as string | undefined,
    cta: "Ξεκίνα 7 ημέρες δωρεάν",
  },
  {
    id: "semiannual",
    name: "Εξάμηνο",
    price: "€199.99",
    per: "/ 6 μήνες",
    blurb: "≈ €33,33/μήνα — ένας μήνας δωρεάν σε σχέση με το μηνιαίο.",
    featured: true,
    badge: "1 μήνας δωρεάν",
    cta: "Ξεκίνα 7 ημέρες δωρεάν",
  },
  {
    id: "annual",
    name: "Ετήσιο",
    price: "€399.99",
    per: "/ έτος",
    blurb: "≈ €33,33/μήνα — δύο μήνες δωρεάν σε σχέση με το μηνιαίο.",
    featured: false,
    badge: "2 μήνες δωρεάν",
    cta: "Ξεκίνα 7 ημέρες δωρεάν",
  },
];

const PLAN_INCLUDES = [
  "Όλα τα analytics & equity curve",
  "Αυτόματο sync MT5 & import/export Excel",
  "AI Trading Coach & Mindset Coach",
  "Pre-Market Briefing & Market News",
  "Pattern Analysis & Position Calculator",
  "Απεριόριστοι λογαριασμοί & share cards",
];

const FAQS = [
  [
    "Πώς δουλεύει ο AI Trading Coach;",
    "Ανεβάζεις ένα ή δύο screenshots από TradingView. Ένα vision model διαβάζει το setup και επιστρέφει βαθμολογία 0–100, ετυμηγορία, το risk:reward σου και checklist κριτήριο-προς-κριτήριο — και μετά μπορείς να ρωτήσεις τι να βελτιώσεις.",
  ],
  [
    "Ο Mindset Coach είναι ένα απλό chatbot;",
    "Όχι. Απαντά αυστηρά από επιμελημένη βάση γνώσης trading-ψυχολογίας, εστιασμένη στα θέματα που πραγματικά κοστίζουν χρήματα — revenge trading, FOMO, φόβο και πειθαρχία.",
  ],
  [
    "Είναι ιδιωτικά και ασφαλή τα δεδομένα μου;",
    "Ναι. Κάθε trade είναι δεμένο στον λογαριασμό σου και κρυπτογραφημένο. Οι άλλοι χρήστες δεν βλέπουν ποτέ τα δεδομένα σου, και μπορείς να τα εξάγεις ή να τα διαγράψεις όποτε θες.",
  ],
  [
    "Πώς γίνεται η σύνδεση με MT5;",
    "Σύνδεσε μία φορά τον MetaTrader 5 λογαριασμό σου και τραβάμε με ασφάλεια το ιστορικό σου. Τα νέα trades συγχρονίζονται αυτόματα — χωρίς χειροκίνητη καταχώρηση.",
  ],
  [
    "Υπάρχει δωρεάν δοκιμή;",
    "Ναι. Κάθε πλάνο ξεκινά με 7 ημέρες δωρεάν δοκιμή. Μπορείς να ακυρώσεις πριν λήξει η δοκιμή χωρίς χρέωση.",
  ],
  [
    "Είναι επενδυτική συμβουλή;",
    "Όχι. Το Ultimate Trading Journal είναι εργαλείο analytics και journaling για εκπαιδευτικούς σκοπούς. Οι AI coaches σε βοηθούν να αναλογιστείς τα δικά σου trades — δεν αποτελούν επενδυτική συμβουλή.",
  ],
];

// Calendar mock data
const CAL_DAYS = [
  { n: 2, pl: 210 }, { n: 3, pl: -90 }, { n: 4, pl: 540 }, { n: 5, pl: 120 }, { n: 6, pl: 0 }, { n: 7, empty: true }, { n: 8, empty: true },
  { n: 9, pl: 330 }, { n: 10, pl: 95 }, { n: 11, pl: -240 }, { n: 12, pl: 410 }, { n: 13, pl: 180 }, { n: 14, empty: true }, { n: 15, empty: true },
  { n: 16, pl: 0 }, { n: 17, pl: 760 }, { n: 18, pl: 240 }, { n: 19, pl: -110 }, { n: 20, pl: 0 }, { n: 21, empty: true }, { n: 22, empty: true },
] as Array<{ n: number; pl?: number; empty?: boolean }>;

export default function Landing() {
  useScrollReveal();
  const yearRef = useRef(new Date().getFullYear());

  return (
    <div className="min-h-screen bg-[#070F1C] text-white antialiased overflow-x-hidden font-['Space_Grotesk']">
      <style>{`
        html { scroll-behavior: smooth; }
        .lp-fade { opacity:0; transform:translateY(22px); transition:opacity .6s cubic-bezier(.16,1,.3,1), transform .6s cubic-bezier(.16,1,.3,1); }
        .lp-fade.lp-in { opacity:1; transform:none; }
        details.lp-faq > summary { list-style:none; cursor:pointer; }
        details.lp-faq > summary::-webkit-details-marker { display:none; }
        details.lp-faq[open] .lp-faq-plus { transform:rotate(45deg); }
        .lp-faq-plus { transition:transform .2s ease; }
        details.lp-faq[open] { border-color:rgba(0,148,198,.4) !important; }
      `}</style>

      {/* ===== NAV ===== */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#070F1C]/75 border-b border-white/10">
        <div className="max-w-[1200px] mx-auto px-6 h-[68px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={LOGO}
              alt="Ultimate Trading Journal"
              className="w-9 h-9 rounded-xl object-contain shadow-lg shadow-[#0094C6]/40"
            />
            <div>
              <div className="font-semibold text-sm tracking-wide leading-none">
                ULTIMATE
              </div>
              <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-[0.14em] mt-0.5">
                Trading Journal
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[13px] text-[#8AA0BE]">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="hover:text-white transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <SignInButton mode="modal">
              <button className="px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-white/80 hover:text-white transition-colors">
                Σύνδεση
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider shadow-lg shadow-[#0094C6]/20">
                Ξεκίνα <ArrowRight size={12} strokeWidth={3} />
              </button>
            </SignUpButton>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <header className="relative pt-20 pb-14 text-center overflow-hidden">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[700px]"
          style={{
            background:
              "radial-gradient(circle at center,rgba(0,148,198,0.22),transparent 62%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.6]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)",
            backgroundSize: "46px 46px",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 60% at 50% 30%,#000,transparent 75%)",
            maskImage:
              "radial-gradient(ellipse 70% 60% at 50% 30%,#000,transparent 75%)",
          }}
        />
        <div className="relative max-w-[1200px] mx-auto px-6">
          <div className="lp-fade">
            <span className="inline-flex items-center gap-2 border border-white/15 bg-[#0094C6]/[0.08] rounded-full px-4 py-1.5 text-xs text-[#8AA0BE] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00C2A0] shadow-[0_0_10px_#00C2A0]" />
              Φτιαγμένο για σοβαρούς MT5 traders · τώρα με AI coach
            </span>
            <h1 className="font-semibold text-4xl sm:text-6xl md:text-7xl leading-[1.02] tracking-tight">
              Κατέγραψε κάθε trade.
              <br />
              <span className="bg-gradient-to-br from-[#00B4D8] to-[#0094C6] bg-clip-text text-transparent">
                Κατάκτησε
              </span>{" "}
              κάθε insight.
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-[#8AA0BE] text-base sm:text-xl leading-relaxed">
              Το επαγγελματικό trading journal που μετατρέπει το ιστορικό σου από
              τον MT5 σε καθαρά analytics — μαζί με έναν AI trading coach και
              mindset coach που σε βοηθούν να διορθώσεις τη στρατηγική και την
              ψυχολογία σου.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
              <SignUpButton mode="modal">
                <button className="flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] rounded-xl text-xs font-mono font-semibold uppercase tracking-wider shadow-lg shadow-[#0094C6]/25 transition-all hover:-translate-y-0.5">
                  Δημιούργησε λογαριασμό{" "}
                  <ArrowRight size={14} strokeWidth={3} />
                </button>
              </SignUpButton>
              <a
                href="#coach"
                className="px-5 py-3 border border-white/15 hover:border-white/40 rounded-xl text-xs font-mono font-semibold uppercase tracking-wider text-white/80 hover:text-white transition-all"
              >
                Γνώρισε τον AI coach
              </a>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-6 text-xs font-mono text-[#4A6080]">
              <span className="inline-flex items-center gap-1.5">
                <Check size={13} className="text-[#00C2A0]" /> 7 ημέρες δωρεάν
                δοκιμή
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={13} className="text-[#00C2A0]" /> Σύνδεση MT5 σε 60
                δευτερόλεπτα
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={13} className="text-[#00C2A0]" /> Ιδιωτικό από
                προεπιλογή
              </span>
            </div>
          </div>

          {/* HERO PRODUCT SHOT */}
          <div className="lp-fade mt-14 max-w-[1040px] mx-auto">
            <BrowserFrame url="ultimatradingjournal.com/dashboard">
              <div className="grid md:grid-cols-2 gap-3">
                <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { l: "Net P/L", v: "+€34.402", c: "text-[#00C2A0]" },
                    { l: "Win rate", v: "51.5%", c: "text-white" },
                    { l: "Profit factor", v: "1.45", c: "text-[#00C2A0]" },
                    { l: "Max drawdown", v: "-5.31%", c: "text-[#E94F37]" },
                  ].map((k) => (
                    <div
                      key={k.l}
                      className="rounded-lg border border-white/10 bg-[#0D1E35] p-3"
                    >
                      <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#4A6080]">
                        {k.l}
                      </div>
                      <div className={`text-[19px] font-bold mt-1 ${k.c}`}>
                        {k.v}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0D1E35] p-4">
                  <h4 className="text-[12px] font-semibold text-white/90 mb-2.5">
                    Equity curve · εύρος
                  </h4>
                  <svg
                    viewBox="0 0 400 130"
                    preserveAspectRatio="none"
                    className="w-full h-[130px]"
                  >
                    <defs>
                      <linearGradient id="eq1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00C2A0" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#00C2A0" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,105 L40,96 L80,103 L120,82 L160,87 L200,62 L240,69 L280,47 L320,36 L360,25 L400,15 L400,130 L0,130 Z"
                      fill="url(#eq1)"
                    />
                    <path
                      d="M0,105 L40,96 L80,103 L120,82 L160,87 L200,62 L240,69 L280,47 L320,36 L360,25 L400,15"
                      fill="none"
                      stroke="#00C2A0"
                      strokeWidth="2.5"
                    />
                  </svg>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0D1E35] p-4">
                  <h4 className="text-[12px] font-semibold text-white/90 mb-2.5">
                    Πρόσφατα trades
                  </h4>
                  <div className="flex flex-col">
                    {[
                      { s: "AUDNZD", v: "+€939", c: "text-[#00C2A0]" },
                      { s: "GBPJPY", v: "+€915", c: "text-[#00C2A0]" },
                      { s: "AUDCAD", v: "-€800", c: "text-[#E94F37]" },
                      { s: "US30.cash", v: "+€695", c: "text-[#00C2A0]" },
                    ].map((t, i, arr) => (
                      <div
                        key={t.s}
                        className={`flex items-center justify-between text-xs py-2 ${
                          i < arr.length - 1 ? "border-b border-white/10" : ""
                        }`}
                      >
                        <span className="font-mono font-semibold">{t.s}</span>
                        <span className={`font-mono font-semibold ${t.c}`}>
                          {t.v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </BrowserFrame>
          </div>
        </div>
      </header>

      {/* ===== STATS STRIP ===== */}
      <div className="border-y border-white/10 py-10 mt-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.16em] text-[#4A6080] mb-6">
            Ό,τι χρειάζεται ένας πειθαρχημένος trader σε ένα μέρος
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {STATS.map((s) => (
              <div key={s.label} className="lp-fade">
                <div className="text-4xl font-bold bg-gradient-to-br from-white to-[#00B4D8] bg-clip-text text-transparent">
                  {s.value}
                </div>
                <div className="text-xs text-[#8AA0BE] mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== AI COACH SECTION ===== */}
      <section id="coach" className="py-24 relative overflow-hidden">
        <div
          className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[600px]"
          style={{
            background:
              "radial-gradient(circle,rgba(94,96,206,0.12),transparent 60%)",
          }}
        />
        <div className="relative max-w-[1200px] mx-auto px-6">
          <div className="lp-fade text-center max-w-2xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 border border-[#5E60CE]/40 bg-[#5E60CE]/10 rounded-full px-4 py-1.5 text-xs text-[#B9B5F0] mb-5">
              <Sparkles size={13} /> Ο λόγος που οι traders μένουν
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
              Ο προσωπικός σου AI trading & mindset coach
            </h2>
            <p className="text-[#8AA0BE] text-lg">
              Τα περισσότερα journals απλώς αποθηκεύουν δεδομένα. Το Ultimate
              Trading Journal αναλύει τα charts και την ψυχολογία σου — και σου
              λέει ακριβώς τι να διορθώσεις.
            </p>
          </div>

          {/* Trading Coach */}
          <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center mb-24">
            <div className="lp-fade">
              <div className="inline-flex items-center gap-2 text-[#00C2A0] font-mono text-[11px] uppercase tracking-[0.18em] mb-3.5">
                <Activity size={14} /> Trading Coach
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3.5 leading-tight">
                Ανέβασε ένα chart. Πάρε βαθμολογημένη, δομημένη ανάλυση.
              </h3>
              <p className="text-[#8AA0BE] text-base leading-relaxed mb-5">
                Ρίξε ένα ή δύο screenshots από TradingView (π.χ. H1 + H4). Ένα
                vision model διαβάζει το setup και επιστρέφει βαθμολογία 0–100,
                ετυμηγορία, το risk:reward σου, ανάγνωση session και πλήρες
                checklist κριτήριο-προς-κριτήριο — και μετά μπορείς να ρωτήσεις
                «τι να διορθώσω;».
              </p>
              <ul className="flex flex-col gap-3">
                {[
                  "Βαθμολογία setup 0–100 με ξεκάθαρη ετυμηγορία",
                  "Checklist ανά κριτήριο: τάση, δομή, RR, timing",
                  "Αριθμητικό risk:reward και ανάγνωση session/timing",
                  "Ρώτα follow-ups στο chat μετά από κάθε ανάλυση",
                ].map((t) => (
                  <li
                    key={t}
                    className="flex gap-3 items-start text-sm text-white/85"
                  >
                    <Check size={16} className="text-[#00C2A0] mt-0.5 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-fade">
              <BrowserFrame url="ultimatradingjournal.com/trading-coach">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-[88px] h-[88px] shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#00C896" strokeWidth="8" strokeLinecap="round" strokeDasharray="263.9" strokeDashoffset="58.06" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-[#00C896]">78</span>
                      <span className="font-mono text-[8px] text-[#4A6080] uppercase">/ 100</span>
                    </div>
                  </div>
                  <div>
                    <div className="inline-block font-mono text-[9px] uppercase tracking-wider text-[#00C896] border border-[#00C896]/35 rounded-md px-2 py-0.5 mb-1.5">
                      Κατάλληλο setup
                    </div>
                    <div className="text-[13px] text-white/85 leading-snug">
                      <span className="font-mono text-[#8AA0BE]">XAUUSD · H1 · </span>
                      <span className="font-semibold text-[#00C2A0]">LONG</span>
                      <span className="font-mono text-[#8AA0BE]"> · RR 1:2.4</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0F2440] p-3 mb-3 text-[12px] text-[#A8B5C7] leading-relaxed">
                  Καθαρό break & retest στη ζώνη στήριξης, ευθυγραμμισμένο με την
                  τάση H4. Πρόσεξε το timing εισόδου κοντά στο NY open.
                </div>
                <div className="flex flex-col gap-1.5">
                  {[
                    { l: "Ευθυγράμμιση τάσης", s: "ok" },
                    { l: "Δομή αγοράς", s: "ok" },
                    { l: "Risk : reward ≥ 2", s: "ok" },
                    { l: "Timing εισόδου / session", s: "warn" },
                    { l: "Τοποθέτηση stop", s: "bad" },
                  ].map((c) => (
                    <div key={c.l} className="flex items-center gap-2.5 text-[12px]">
                      <span
                        className="w-5 h-5 rounded-md grid place-items-center text-[11px] font-bold shrink-0"
                        style={{
                          background:
                            c.s === "ok"
                              ? "rgba(0,137,123,0.15)"
                              : c.s === "warn"
                                ? "rgba(244,162,97,0.15)"
                                : "rgba(233,79,55,0.15)",
                          color:
                            c.s === "ok"
                              ? "#00C896"
                              : c.s === "warn"
                                ? "#F4A261"
                                : "#E94F37",
                        }}
                      >
                        {c.s === "ok" ? (
                          <Check size={11} />
                        ) : c.s === "warn" ? (
                          <Minus size={11} />
                        ) : (
                          <X size={11} />
                        )}
                      </span>
                      <span className="text-white/85">{c.l}</span>
                    </div>
                  ))}
                </div>
              </BrowserFrame>
            </div>
          </div>

          {/* Mindset Coach */}
          <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center">
            <div className="lp-fade order-2 md:order-1">
              <BrowserFrame url="ultimatradingjournal.com/mindset-coach">
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2.5 flex-row-reverse">
                    <span className="shrink-0 w-7 h-7 rounded-lg grid place-items-center bg-[#0077B6]/15 text-[#0094C6] text-xs">
                      Εγώ
                    </span>
                    <div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12.5px] bg-[#0077B6]/15 text-[#E6EEF8]">
                      Κάνω συνέχεια revenge-trading μετά από loss. Πώς το σταματάω;
                    </div>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="shrink-0 w-7 h-7 rounded-lg grid place-items-center bg-[#5E60CE]/15 text-[#9B7BE0]">
                      <Brain size={14} />
                    </span>
                    <div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12.5px] bg-[#0D1E35] border border-white/10 text-[#D6DEEA] leading-relaxed">
                      Το revenge trading είναι ο εγκέφαλός σου που προσπαθεί να
                      «κερδίσει πίσω» το loss συναισθηματικά. Βάλε αυστηρό κανόνα:
                      μετά από ένα loss, απομακρύνσου για 15 λεπτά και κατάγραψε
                      πώς νιώθεις εδώ πρώτα. Η παύση σπάει τον φαύλο κύκλο.
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {["Φοβάμαι να πατήσω το κουμπί", "Κάνω overtrade όταν βαριέμαι"].map(
                      (p) => (
                        <div
                          key={p}
                          className="rounded-xl border border-white/10 bg-[#0D1E35]/70 px-3 py-2"
                        >
                          <div className="flex items-center gap-1.5">
                            <Sparkles size={12} className="text-[#9B7BE0]" />
                            <span className="font-semibold text-[11px] text-white">
                              {p}
                            </span>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 rounded-xl border border-white/10 bg-[#0F2440] px-3 py-2 text-[11px] text-[#4A6080]">
                      Ρώτα τον mindset coach…
                    </div>
                    <span className="w-8 h-8 rounded-xl grid place-items-center bg-[#5E60CE] text-white">
                      <Send size={14} />
                    </span>
                    <span className="w-8 h-8 rounded-xl grid place-items-center border border-white/10 text-[#8AA0BE]">
                      <Mic size={14} />
                    </span>
                  </div>
                </div>
              </BrowserFrame>
            </div>
            <div className="lp-fade order-1 md:order-2">
              <div className="inline-flex items-center gap-2 text-[#9B7BE0] font-mono text-[11px] uppercase tracking-[0.18em] mb-3.5">
                <Brain size={14} /> Mindset Coach
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3.5 leading-tight">
                Νίκησε την ψυχολογία που σου κοστίζει χρήματα
              </h3>
              <p className="text-[#8AA0BE] text-base leading-relaxed mb-5">
                Revenge trading, FOMO, φόβος, παραβίαση των δικών σου κανόνων — ο
                Mindset Coach είναι ένας συνομιλιακός coach ψυχολογίας που απαντά
                από επιμελημένη βάση γνώσης trading-ψυχολογίας, ώστε να χτίσεις
                σταθερό, πειθαρχημένο μυαλό.
              </p>
              <ul className="flex flex-col gap-3">
                {[
                  "Συζήτησε φόβο, ανυπομονησία, πειθαρχία & αμφιβολία",
                  "Έτοιμα prompts για να ξεκινήσεις με ένα κλικ",
                  "Τεκμηριωμένες απαντήσεις — όχι γενικό chatbot",
                ].map((t) => (
                  <li
                    key={t}
                    className="flex gap-3 items-start text-sm text-white/85"
                  >
                    <Check size={16} className="text-[#00C2A0] mt-0.5 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MORE AI: Briefing + News + Patterns ===== */}
      <section className="pb-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="lp-fade text-center max-w-2xl mx-auto mb-12">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#0094C6]">
              Και υπάρχει κι άλλο AI
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-3.5">
              Μπες σε κάθε session προετοιμασμένος
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {/* Briefing */}
            <div className="lp-fade">
              <BrowserFrame url="/pre-market-briefing">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-[13px] flex items-center gap-1.5">
                    <Sun size={14} className="text-[#F4A261]" /> Pre-Market Briefing
                  </h4>
                  <span className="font-mono text-[9px] text-[#4A6080]">07:00</span>
                </div>
                <p className="text-[11.5px] text-[#8AA0BE] leading-relaxed mb-2.5">
                  <span className="text-white font-semibold">Sentiment:</span>{" "}
                  Risk-on προς το US session· το DXY υποχωρεί πριν τον CPI.
                </p>
                <div className="rounded-lg border border-[#E94F37]/30 bg-[#E94F37]/10 p-2.5">
                  <div className="font-mono text-[9px] tracking-wider text-[#E94F37] mb-1">
                    ΥΨΗΛΗ ΕΠΙΔΡΑΣΗ ΣΗΜΕΡΑ
                  </div>
                  <div className="text-[11px] text-white/85">13:30 UTC · USD CPI</div>
                </div>
              </BrowserFrame>
            </div>
            {/* News */}
            <div className="lp-fade">
              <BrowserFrame url="/market-news">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-[13px] flex items-center gap-1.5">
                    <Newspaper size={14} className="text-[#0094C6]" /> Market News
                  </h4>
                  <span className="font-mono text-[9px] text-[#E94F37]">High only</span>
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    { c: "USD", t: "CPI m/m", i: "HIGH", col: "#E94F37" },
                    { c: "EUR", t: "ECB Speech", i: "MED", col: "#F4A261" },
                    { c: "GBP", t: "GDP q/q", i: "HIGH", col: "#E94F37" },
                  ].map((n) => (
                    <div
                      key={n.c}
                      className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-[#0F2440] px-2.5 py-2"
                    >
                      <span className="font-mono text-[10px] font-bold w-9 text-[#8AA0BE]">
                        {n.c}
                      </span>
                      <span className="text-[11.5px] text-white/85 flex-1">{n.t}</span>
                      <span
                        className="font-mono text-[8px] px-1.5 py-0.5 rounded"
                        style={{ background: `${n.col}26`, color: n.col }}
                      >
                        {n.i}
                      </span>
                    </div>
                  ))}
                </div>
              </BrowserFrame>
            </div>
            {/* Pattern */}
            <div className="lp-fade">
              <BrowserFrame url="/pattern-analysis">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-[13px] flex items-center gap-1.5">
                    <PieChart size={14} className="text-[#9B7BE0]" /> Pattern Analysis
                  </h4>
                  <span className="font-mono text-[9px] text-[#4A6080]">
                    Win rate ανά setup
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {[
                    { l: "London open", v: 86 },
                    { l: "NY session", v: 64 },
                    { l: "Asian range", v: 38 },
                  ].map((p) => (
                    <div key={p.l}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-white/85">{p.l}</span>
                        <span className="font-mono text-[#9B7BE0]">{p.v}%</span>
                      </div>
                      <div className="h-1.5 bg-[#0F2440] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#9B7BE0]"
                          style={{ width: `${p.v}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </BrowserFrame>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CALENDAR SHOWCASE ===== */}
      <section className="pb-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center">
            <div className="lp-fade">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#0094C6]">
                Το journal
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold mt-3.5 mb-3.5 leading-tight">
                Δες τον μήνα σου με μια ματιά
              </h3>
              <p className="text-[#8AA0BE] text-base leading-relaxed mb-5">
                Το ημερολόγιο P/L μετατρέπει τον μήνα σου σε heatmap — πράσινες
                μέρες, κόκκινες μέρες και τα μοτίβα από πίσω. Κάνε κλικ σε
                οποιαδήποτε μέρα για να δεις τα trades που την έφτιαξαν.
              </p>
              <ul className="flex flex-col gap-3">
                {[
                  "Ημερήσιο heatmap P/L με μετρητές win/loss",
                  "KPIs ανά μήνα, equity curve & drawdown",
                  "Drag-and-drop εισαγωγή Excel για ολόκληρο μήνα",
                ].map((t) => (
                  <li
                    key={t}
                    className="flex gap-3 items-start text-sm text-white/85"
                  >
                    <Check size={16} className="text-[#00C2A0] mt-0.5 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-fade">
              <BrowserFrame url="ultimatradingjournal.com/calendar">
                <h4 className="font-semibold text-[13px] mb-1">
                  Ιούνιος · Ημερολόγιο P/L
                </h4>
                <p className="text-[10px] text-[#8AA0BE] mb-3 font-mono">
                  Πράσινο = κέρδος · κόκκινο = ζημία
                </p>
                <div className="grid grid-cols-7 gap-1.5">
                  {["Δ", "Τ", "Τ", "Π", "Π", "Σ", "Κ"].map((d, i) => (
                    <div
                      key={i}
                      className="font-mono text-[8px] text-[#4A6080] text-center pb-1"
                    >
                      {d}
                    </div>
                  ))}
                  {CAL_DAYS.map((d, i) => {
                    const pl = d.pl || 0;
                    const win = pl > 0;
                    const loss = pl < 0;
                    const cls = d.empty
                      ? "opacity-25 border-white/10"
                      : win
                        ? "bg-[#00C2A0]/14 border-[#00C2A0]/30"
                        : loss
                          ? "bg-[#E94F37]/13 border-[#E94F37]/30"
                          : "border-white/10";
                    return (
                      <div
                        key={i}
                        className={`aspect-square rounded-md border p-1 flex flex-col justify-between ${cls}`}
                      >
                        <span className="font-mono text-[8px] text-[#4A6080]">
                          {d.n}
                        </span>
                        {d.pl != null && !d.empty && (
                          <span
                            className={`text-[9px] font-bold ${
                              win ? "text-[#00C2A0]" : loss ? "text-[#E94F37]" : "text-[#4A6080]"
                            }`}
                          >
                            {win ? "+" : ""}
                            {d.pl}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </BrowserFrame>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURE GRID ===== */}
      <section
        id="features"
        className="py-24 bg-gradient-to-b from-transparent via-[#0D1E35]/40 to-transparent"
      >
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="lp-fade text-center max-w-2xl mx-auto mb-14">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#0094C6]">
              Η πλήρης εργαλειοθήκη
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mt-3.5 mb-4">
              Όλα σε ένα journal
            </h2>
            <p className="text-[#8AA0BE] text-lg">
              Σταμάτα να ζογκλάρεις spreadsheets και screenshots. Κάθε εργαλείο
              που χρειάζεται ένας σοβαρός trader, σε έναν ιδιωτικό χώρο εργασίας.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="lp-fade relative rounded-2xl border border-white/10 bg-gradient-to-b from-[#0D1E35] to-[#0D1E35]/60 p-6 transition-all hover:-translate-y-1 hover:border-[#0094C6]/45 hover:shadow-[0_18px_50px_rgba(0,0,0,0.4)]"
              >
                {f.badge && (
                  <span className="absolute top-4 right-4 font-mono text-[9px] uppercase tracking-wider text-[#9B7BE0] border border-[#9B7BE0]/35 rounded-md px-1.5 py-0.5">
                    {f.badge}
                  </span>
                )}
                <div
                  className={`w-11 h-11 rounded-xl grid place-items-center mb-4 ${TONE_MAP[f.tone]}`}
                >
                  {f.icon}
                </div>
                <h3 className="text-[17px] font-semibold mb-2">{f.title}</h3>
                <p className="text-[#8AA0BE] text-sm leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WORKFLOW ===== */}
      <section id="workflow" className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="lp-fade text-center max-w-2xl mx-auto mb-14">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#0094C6]">
              Πώς δουλεύει
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mt-3.5">
              Από μπερδεμένο ιστορικό σε ξεκάθαρο edge σε 3 βήματα
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {WORKFLOW.map((s) => (
              <div
                key={s.n}
                className="lp-fade relative rounded-2xl border border-white/10 bg-gradient-to-b from-[#0D1E35] to-[#0D1E35]/60 p-6"
              >
                <div
                  className={`w-11 h-11 rounded-xl grid place-items-center mb-4 font-mono font-bold text-base ${TONE_MAP[s.tone]}`}
                >
                  {s.n}
                </div>
                <h3 className="text-[17px] font-semibold mb-2">{s.title}</h3>
                <p className="text-[#8AA0BE] text-sm leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section
        id="pricing"
        className="py-24 bg-gradient-to-b from-transparent via-[#0D1E35]/40 to-transparent"
      >
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="lp-fade text-center max-w-2xl mx-auto mb-14">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#0094C6]">
              Τιμές
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mt-3.5 mb-4">
              Ξεκίνα με 7 ημέρες δωρεάν. Ακύρωση όποτε θες.
            </h2>
            <p className="text-[#8AA0BE] text-lg">
              Ένα loss που αποφεύγεις καλύπτει μήνες συνδρομής. Όλα τα πλάνα
              περιλαμβάνουν κάθε δυνατότητα.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 max-w-[420px] md:max-w-none mx-auto items-stretch">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`lp-fade relative flex flex-col rounded-2xl p-8 bg-[#0D1E35] ${
                  p.featured
                    ? "border border-[#0094C6] shadow-[0_0_0_1px_#0094C6,0_20px_60px_rgba(0,148,198,0.18)]"
                    : "border border-white/10"
                }`}
              >
                {p.badge && (
                  <span
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-wider px-3.5 py-1 rounded-full font-semibold ${
                      p.featured
                        ? "bg-gradient-to-br from-[#0094C6] to-[#005377]"
                        : "bg-[#00C2A0]/20 text-[#00C2A0] border border-[#00C2A0]/40"
                    }`}
                  >
                    {p.badge}
                  </span>
                )}
                <div className="font-mono text-xs uppercase tracking-[0.12em] text-[#8AA0BE]">
                  {p.name}
                </div>
                <div className="text-[42px] font-bold mt-3.5 leading-none">
                  {p.price}
                  <span className="text-[15px] text-[#8AA0BE] font-normal">
                    {" "}
                    {p.per}
                  </span>
                </div>
                <p className="text-[#8AA0BE] text-[13px] mt-3 mb-5 min-h-[38px]">
                  {p.blurb}
                </p>
                <ul className="flex flex-col gap-3 mb-6 flex-1">
                  {PLAN_INCLUDES.map((inc) => (
                    <li
                      key={inc}
                      className="flex gap-2.5 text-[13.5px] text-white/85"
                    >
                      <Check size={15} className="text-[#00C2A0] mt-0.5 shrink-0" />
                      {inc}
                    </li>
                  ))}
                </ul>
                <SignUpButton mode="modal">
                  <button
                    className={`w-full justify-center flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-mono font-semibold uppercase tracking-wider transition-all ${
                      p.featured
                        ? "bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] shadow-lg shadow-[#0094C6]/25"
                        : "border border-white/15 hover:border-white/40 text-white/85 hover:text-white"
                    }`}
                  >
                    {p.cta} <ArrowRight size={13} strokeWidth={3} />
                  </button>
                </SignUpButton>
              </div>
            ))}
          </div>
          <p className="text-center text-[#4A6080] text-xs font-mono mt-6">
            Όλα τα πλάνα ξεκινούν με 7 ημέρες δωρεάν δοκιμή · Πληρωμές μέσω Stripe
          </p>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="lp-fade text-center max-w-2xl mx-auto mb-12">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#0094C6]">
              Συχνές ερωτήσεις
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mt-3.5">
              Απαντήσεις στις ερωτήσεις σου
            </h2>
          </div>
          <div className="max-w-[760px] mx-auto flex flex-col gap-3">
            {FAQS.map(([q, a], i) => (
              <details
                key={i}
                open={i === 0}
                className="lp-faq lp-fade rounded-xl border bg-[#0D1E35] px-5 transition-colors border-white/10"
              >
                <summary className="w-full flex items-center justify-between py-4 text-left font-semibold text-[15px]">
                  {q}
                  <span className="lp-faq-plus text-[#00B4D8] text-2xl leading-none shrink-0">
                    +
                  </span>
                </summary>
                <p className="text-[#8AA0BE] text-sm leading-relaxed pb-4">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="pb-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="lp-fade relative text-center px-6 sm:px-10 py-20 rounded-[26px] border border-white/15 bg-gradient-to-br from-[#0F2440] to-[#0A1628] overflow-hidden">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 0%,rgba(0,148,198,0.25),transparent 60%)",
              }}
            />
            <h2 className="relative text-2xl sm:text-4xl font-bold tracking-tight mb-4">
              Τα επόμενα 100 trades σου αξίζουν ένα καλύτερο journal.
            </h2>
            <p className="relative text-[#8AA0BE] text-lg max-w-xl mx-auto mb-7">
              Ένωσε δυνάμεις με σοβαρούς MT5 traders που σταμάτησαν να μαντεύουν
              και άρχισαν να μετρούν — με έναν AI coach στη γωνία τους.
            </p>
            <div className="relative flex flex-wrap justify-center gap-3.5">
              <SignUpButton mode="modal">
                <button className="flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] rounded-xl text-xs font-mono font-semibold uppercase tracking-wider shadow-lg shadow-[#0094C6]/25 transition-all hover:-translate-y-0.5">
                  Δημιούργησε λογαριασμό{" "}
                  <ArrowRight size={14} strokeWidth={3} />
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button className="px-5 py-3 border border-white/15 hover:border-white/40 rounded-xl text-xs font-mono font-semibold uppercase tracking-wider text-white/80 hover:text-white transition-all">
                  Έχω ήδη λογαριασμό
                </button>
              </SignInButton>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/10 pt-12 pb-8">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex flex-wrap justify-between gap-8">
            <div className="max-w-[280px]">
              <div className="flex items-center gap-3 mb-3.5">
                <img src={LOGO} alt="" className="w-9 h-9 rounded-xl object-contain" />
                <div>
                  <div className="font-semibold text-sm leading-none">ULTIMATE</div>
                  <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-[0.14em] mt-0.5">
                    Trading Journal
                  </div>
                </div>
              </div>
              <p className="text-[#8AA0BE] text-[13px] leading-relaxed">
                Κατέγραψε κάθε trade. Κατάκτησε κάθε insight. Το επαγγελματικό
                journal για σοβαρούς MT5 traders — τώρα με AI coach.
              </p>
            </div>
            <div>
              <h5 className="font-mono text-xs uppercase tracking-[0.12em] text-[#4A6080] mb-3.5">
                Προϊόν
              </h5>
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="block text-[#8AA0BE] text-[13px] mb-2.5 hover:text-white transition-colors"
                >
                  {l.label}
                </a>
              ))}
            </div>
            <div>
              <h5 className="font-mono text-xs uppercase tracking-[0.12em] text-[#4A6080] mb-3.5">
                Λογαριασμός
              </h5>
              <SignInButton mode="modal">
                <button className="block text-[#8AA0BE] text-[13px] mb-2.5 hover:text-white transition-colors">
                  Σύνδεση
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="block text-[#8AA0BE] text-[13px] mb-2.5 hover:text-white transition-colors">
                  Δημιουργία λογαριασμού
                </button>
              </SignUpButton>
            </div>
          </div>
          <div className="mt-9 pt-5 border-t border-white/10 flex flex-wrap justify-between gap-2.5 font-mono text-[11px] text-[#4A6080] uppercase tracking-wider">
            <span>© {yearRef.current} Ultimate Trading Journal</span>
            <span>Secured by Clerk · Payments by Stripe</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
