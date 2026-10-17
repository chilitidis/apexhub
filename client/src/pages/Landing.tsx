// Public marketing landing page shown to signed-out visitors (Clerk active).
// 1:1 implementation of the approved "Sample C" design: navy palette
// (#0A0A0B / #121214), teal→blue gradient CTAs, Space Grotesk headings and
// JetBrains Mono accents. Bilingual EN/EL via LANDING_CONTENT — all copy comes
// from client/src/lib/landingContent.ts. Core trading terms stay in English in
// both languages. Funnels visitors to Clerk SignIn / SignUp modals.

import React, { useRef, useState } from "react";
import { SignInButton, SignUpButton } from "@clerk/clerk-react";
void React;
import {
  ArrowRight,
  Bot,
  Brain,
  Calculator,
  CalendarDays,
  CalendarPlus,
  Check,
  FileSpreadsheet,
  LayoutGrid,
  LineChart,
  ListChecks,
  Newspaper,
  PieChart,
  Plus,
  RefreshCw,
  Shield,
  Sun,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LANDING_CONTENT } from "@/lib/landingContent";

const LOGO =
  "/favicon-v4.png";

// ===== Palette (from the approved sample) =====
// navy #0A0A0B · navy2 #121214 · card #121214 · line rgba(255,255,255,0.06)
// blue #C9A24A · blue2 #C9A24A · teal #3FB68B · coral #E5484D · gold #C9A24A
// txt #F2EFE8 · mut #8E8A82

const MONO = "font-['JetBrains_Mono',monospace]";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-[22px] py-3 text-sm font-semibold cursor-pointer transition-all duration-200";
const BTN_PRIMARY = `${BTN_BASE} bg-gradient-to-br from-[#E6C873] to-[#A87B2A] text-[#141414] shadow-[0_8px_28px_rgba(201,162,74,0.30)] hover:-translate-y-0.5 hover:shadow-[0_14px_38px_rgba(201,162,74,0.45)]`;
const BTN_GHOST = `${BTN_BASE} border border-[rgba(255,255,255,0.10)] text-[#F2EFE8] hover:border-[rgba(201,162,74,0.45)] hover:text-[#E6C873]`;

// Resolve a tool icon key (from landingContent.ts) to a rendered icon.
const ICON_MAP: Record<string, React.ReactNode> = {
  Plus: <Plus size={20} />,
  RefreshCw: <RefreshCw size={20} />,
  CalendarPlus: <CalendarPlus size={20} />,
  ListChecks: <ListChecks size={20} />,
  Wallet: <Wallet size={20} />,
  TrendingUp: <TrendingUp size={20} />,
  FileSpreadsheet: <FileSpreadsheet size={20} />,
  LayoutGrid: <LayoutGrid size={20} />,
  CalendarDays: <CalendarDays size={20} />,
  Calculator: <Calculator size={20} />,
  PieChart: <PieChart size={20} />,
  Brain: <Brain size={20} />,
  LineChart: <LineChart size={20} />,
  Sun: <Sun size={20} />,
  Newspaper: <Newspaper size={20} />,
  Shield: <Shield size={20} />,
};

// Workflow step number tones.
const STEP_TONES: Record<string, React.CSSProperties> = {
  ocean: { background: "rgba(201,162,74,.12)", color: "#C9A24A", border: "1px solid rgba(201,162,74,.3)" },
  gold: { background: "rgba(244,185,66,.12)", color: "#C9A24A", border: "1px solid rgba(244,185,66,.3)" },
  profit: { background: "rgba(201,162,74,.12)", color: "#C9A24A", border: "1px solid rgba(201,162,74,.3)" },
};

// Check-status chip styles (Trading Coach mock).
const STATUS_STYLES: Record<"ok" | "warn" | "bad", string> = {
  ok: "text-[#3FB68B] bg-[rgba(201,162,74,0.1)] border border-[rgba(201,162,74,0.3)]",
  warn: "text-[#C9A24A] bg-[rgba(244,185,66,0.1)] border border-[rgba(244,185,66,0.3)]",
  bad: "text-[#E5484D] bg-[rgba(233,79,55,0.1)] border border-[rgba(233,79,55,0.3)]",
};

// P/L calendar mock — mirrors the sample's July layout (Monday-first).
const CAL_DAYS: Array<{ d?: number; k?: "g" | "g2" | "r" }> = [
  {}, { d: 1, k: "g" }, { d: 2, k: "g2" }, { d: 3, k: "r" }, { d: 4, k: "g" }, { d: 5 }, { d: 6 },
  { d: 7, k: "g" }, { d: 8, k: "g2" }, { d: 9 }, { d: 10, k: "g" }, { d: 11, k: "r" }, { d: 12 }, { d: 13 },
  { d: 14, k: "r" }, { d: 15, k: "g" }, { d: 16, k: "g" }, { d: 17, k: "g2" }, { d: 18, k: "g" }, { d: 19 }, { d: 20 },
  { d: 21, k: "g" }, { d: 22 }, { d: 23, k: "g2" }, { d: 24, k: "g" }, { d: 25, k: "r" }, { d: 26 }, { d: 27 },
  { d: 28, k: "g" }, { d: 29, k: "g" }, { d: 30, k: "g2" }, { d: 31, k: "g" }, {}, {}, {},
];

const CAL_DAY_STYLES: Record<string, string> = {
  g: "bg-[rgba(63,182,139,0.14)] border-[rgba(63,182,139,0.35)] text-[#3FB68B]",
  g2: "bg-[rgba(63,182,139,0.28)] border-[rgba(63,182,139,0.5)] text-[#3FB68B]",
  r: "bg-[rgba(229,72,77,0.14)] border-[rgba(229,72,77,0.35)] text-[#E5484D]",
};

// ===== Small UI atoms =====

/** Renders a string whose **bold** segments are marked with double asterisks. */
function Bold({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <b key={i} className="text-[#F2EFE8] font-semibold">
            {p}
          </b>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

/** Browser-chrome frame used by every product mock in the sample. */
function Browser({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-gradient-to-b from-[#121214] to-[#0A0A0B] shadow-[0_30px_80px_rgba(0,0,0,0.45)] overflow-hidden">
      <div className={`flex items-center gap-[7px] px-3.5 py-2.5 border-b border-[rgba(255,255,255,0.06)] ${MONO} text-[10.5px] text-[#8E8A82]`}>
        <span className="w-[5px] h-[5px] rounded-full inline-block bg-[#C9A24A]" />
        <span className="ml-1 truncate">{url}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/** Centered section header: mono kicker + h2 (+ optional subtitle). */
function SectionHead({ tag, title, sub }: { tag: string; title: string; sub?: string }) {
  return (
    <>
      <div className={`${MONO} text-[11px] tracking-[0.24em] text-[#C9A24A] font-semibold text-center uppercase`}>
        {tag}
      </div>
      <h2 className="font-display text-[clamp(30px,3.8vw,42px)] tracking-[-0.01em] mt-3 text-center leading-[1.25]">
        {title}
      </h2>
      {sub && (
        <p className="text-center text-[#8E8A82] max-w-[580px] mx-auto mt-4 leading-[1.7] text-[15.5px]">{sub}</p>
      )}
    </>
  );
}

function Stars() {
  return <div className="text-[#C9A24A] tracking-[2.5px] text-[13px]">★★★★★</div>;
}

export default function Landing() {
  const { lang, toggleLang } = useLanguage();
  const c = LANDING_CONTENT[lang];
  const yearRef = useRef(new Date().getFullYear());
  const [billing, setBilling] = useState<"mo" | "yr">("mo");
  const isYr = billing === "yr";

  const navLinks = [
    { href: "#coach", label: c.nav.coach },
    { href: "#features", label: c.nav.features },
    { href: "#workflow", label: c.nav.workflow },
    { href: "#pricing", label: c.nav.pricing },
    { href: "#faq", label: c.nav.faq },
  ];

  // Weekday initials for the calendar mock — Monday-first.
  const weekdayInitials =
    lang === "el" ? ["Δ", "Τ", "Τ", "Π", "Π", "Σ", "Κ"] : ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#F2EFE8] antialiased overflow-x-hidden font-['Inter',sans-serif]">
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes lp-pulse { 50% { opacity:.35 } }
        @keyframes lp-float { 50% { transform:translateY(-10px) } }
        .lp-faq summary { list-style:none; cursor:pointer; }
        .lp-faq summary::-webkit-details-marker { display:none; }
        .lp-faq summary::after { content:'+'; color:#C9A24A; font-size:22px; font-weight:400; line-height:1; margin-left:16px; flex-shrink:0; }
        .lp-faq[open] summary::after { content:'\\2212'; }
        
      `}</style>

      {/* ===== NAV ===== */}
      <nav className="sticky top-0 z-50 bg-[rgba(10,10,11,0.88)] backdrop-blur-xl border-b border-[rgba(255,255,255,0.06)]">
        <div className="max-w-[1180px] mx-auto px-6 h-[66px] flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-bold tracking-[0.14em] text-sm">
            <img
              src={LOGO}
              alt="ApexHub Trading Journal"
              className="w-9 h-9 rounded-[10px] object-contain"
            />
            <div>
              <div className="leading-none">APEXHUB</div>
              <small className="block text-[9px] text-[#8E8A82] tracking-[0.28em] font-medium mt-0.5">
                TRADING JOURNAL
              </small>
            </div>
          </div>
          <div className="hidden lg:flex gap-[26px] text-sm text-[#8E8A82]">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-[#F2EFE8] transition-colors">
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div
              role="group"
              aria-label="Language"
              className="flex border border-[rgba(255,255,255,0.06)] rounded-lg overflow-hidden text-[11.5px] font-bold"
            >
              {(["en", "el"] as const).map((code) => {
                const active = lang === code;
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      if (!active) toggleLang();
                    }}
                    className={`px-2.5 py-1.5 transition-colors ${
                      active
                        ? "btn-gold"
                        : "text-[#8E8A82] hover:text-[#F2EFE8]"
                    }`}
                  >
                    {code === "en" ? "EN" : "EL"}
                  </button>
                );
              })}
            </div>
            <SignInButton mode="modal">
              <button className={`${BTN_GHOST} hidden sm:inline-flex`}>{c.cta.signIn}</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className={BTN_PRIMARY}>
                {c.cta.start} <ArrowRight size={14} strokeWidth={2.5} />
              </button>
            </SignUpButton>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <header className="relative pt-[88px] pb-[70px]">
        <div
          className="pointer-events-none absolute -right-[220px] -top-[120px] w-[720px] h-[720px]"
          style={{ background: "radial-gradient(circle,rgba(201,162,74,.10),transparent 65%)" }}
        />
        <div
          className="pointer-events-none absolute -left-[250px] -bottom-[150px] w-[600px] h-[600px]"
          style={{ background: "radial-gradient(circle,rgba(201,162,74,.08),transparent 65%)" }}
        />
        <div className="relative z-[1] max-w-[1180px] mx-auto px-6 grid lg:grid-cols-[1.05fr_0.95fr] gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-[9px] text-[13px] text-[#E6C873] bg-[rgba(201,162,74,0.07)] border border-[rgba(201,162,74,0.25)] px-4 py-2 rounded-full">
              <span
                className="w-[7px] h-[7px] rounded-full bg-[#C9A24A] shadow-[0_0_10px_#C9A24A]"
                style={{ animation: "lp-pulse 2s infinite" }}
              />
              {c.hero.badge}
            </div>
            <h1 className="font-display text-[clamp(40px,5vw,60px)] leading-[1.14] font-normal tracking-[-0.01em] mt-[26px]">
              {c.hero.titleA}
              <br />
              <span className="gold-grad-text">
                {c.hero.titleHighlight}
              </span>
            </h1>
            <p className="text-[#8E8A82] text-[17.5px] leading-[1.75] mt-[22px] max-w-[520px]">
              <Bold text={c.hero.subtitle} />
            </p>
            <div className="flex gap-3.5 mt-[34px] flex-wrap">
              <SignUpButton mode="modal">
                <button className={`${BTN_PRIMARY} px-[30px] py-[15px] text-[15px]`}>
                  {c.hero.ctaPrimary}
                </button>
              </SignUpButton>
              <a href="#coach" className={`${BTN_GHOST} px-[30px] py-[15px] text-[15px]`}>
                {c.hero.ctaSecondary}
              </a>
            </div>
            <div className="flex gap-6 mt-6 text-[13px] text-[#8E8A82] flex-wrap">
              {[c.hero.check1, c.hero.check2, c.hero.check3].map((g) => (
                <span key={g} className="inline-flex items-center gap-1.5">
                  <Check size={14} className="text-[#C9A24A]" strokeWidth={3} /> {g}
                </span>
              ))}
            </div>
          </div>

          {/* Phone dashboard mock + AI coach bubble + win toast */}
          <div className="relative min-h-[520px] lg:min-h-[540px] mt-4 lg:mt-0">
            <div
              className="absolute -left-2 lg:-left-8 top-[180px] w-[250px] lg:w-[280px] bg-[#18181B] border border-[rgba(201,162,74,0.4)] rounded-2xl p-[18px] shadow-[0_24px_70px_rgba(0,0,0,0.55)] z-[2]"
              style={{ animation: "lp-float 5s ease-in-out infinite" }}
            >
              <div className="flex gap-2.5 items-center text-xs font-bold tracking-[0.06em]">
                <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#C9A24A] to-[#C9A24A] grid place-items-center">
                  <Bot size={16} />
                </div>
                {c.heroMock.coachTitle}
              </div>
              <div className="mt-3 text-[12.5px] leading-[1.65] text-[#C9C4B9]">{c.heroMock.coachMsg}</div>
              <div className={`inline-block mt-3 ${MONO} text-[10px] text-[#C9A24A] border border-[rgba(244,185,66,0.35)] bg-[rgba(244,185,66,0.08)] px-2.5 py-1 rounded-md`}>
                {c.heroMock.coachTag}
              </div>
            </div>
            <div className="absolute right-0 lg:right-[30px] top-0 w-[280px] bg-[#0A0A0B] border border-[rgba(201,162,74,0.30)] rounded-[34px] p-3.5 shadow-[0_50px_120px_rgba(0,0,0,0.6)]">
              <div className="bg-gradient-to-b from-[#121214] to-[#0A0A0B] rounded-3xl p-[18px] min-h-[470px]">
                <div className={`flex justify-between items-center text-[10px] text-[#8E8A82] tracking-[0.1em] ${MONO}`}>
                  <span>{c.heroMock.month}</span>
                  <span>{c.heroMock.acct}</span>
                </div>
                <div className={`${MONO} text-[30px] font-bold text-[#3FB68B] mt-4`}>{c.heroMock.pl}</div>
                <div className="text-[9.5px] text-[#8E8A82] tracking-[0.14em] mt-1">{c.heroMock.plLabel}</div>
                <svg viewBox="0 0 240 90" preserveAspectRatio="none" className="w-full h-[90px] mt-3.5">
                  <defs>
                    <linearGradient id="lp-pg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#3FB68B" stopOpacity="0.4" />
                      <stop offset="1" stopColor="#3FB68B" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,70 C30,66 40,74 60,60 C85,42 100,55 125,45 C150,35 165,48 190,28 C210,14 225,22 240,10 L240,90 L0,90 Z"
                    fill="url(#lp-pg)"
                  />
                  <path
                    d="M0,70 C30,66 40,74 60,60 C85,42 100,55 125,45 C150,35 165,48 190,28 C210,14 225,22 240,10"
                    fill="none"
                    stroke="#3FB68B"
                    strokeWidth="2.2"
                  />
                </svg>
                <div>
                  {c.heroMock.rows.map((r) => (
                    <div
                      key={r.l}
                      className={`flex justify-between ${MONO} text-[11.5px] py-[9px] border-b border-[rgba(255,255,255,0.05)]`}
                    >
                      <span>{r.l}</span>
                      <span className={r.tone === "up" ? "text-[#3FB68B]" : "text-[#E5484D]"}>{r.v}</span>
                    </div>
                  ))}
                  <div className={`flex justify-between ${MONO} text-[11.5px] py-[9px] border-b border-[rgba(255,255,255,0.05)]`}>
                    <span className="text-[#8E8A82]">{c.heroMock.winRateLabel}</span>
                    <span>{c.heroMock.winRate}</span>
                  </div>
                  <div className={`flex justify-between ${MONO} text-[11.5px] py-[9px]`}>
                    <span className="text-[#8E8A82]">{c.heroMock.pfLabel}</span>
                    <span>{c.heroMock.pf}</span>
                  </div>
                </div>
              </div>
            </div>
            <div
              className={`absolute left-[26px] bottom-[44px] bg-[#121214] border border-[rgba(201,162,74,0.45)] rounded-[14px] px-[18px] py-[13px] ${MONO} text-[12.5px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] z-[2]`}
              style={{ animation: "lp-float 6s ease-in-out infinite 1s" }}
            >
              <span className="text-[#C9A24A]">✓</span> {c.heroMock.toastLead} <b className="text-[#C9A24A]">{c.heroMock.toastBold}</b>{" "}
              {c.heroMock.toastTail}
            </div>
          </div>
        </div>
      </header>

      {/* ===== STATS STRIP ===== */}
      <div
        className="border-y border-[rgba(255,255,255,0.06)]"
        style={{ background: "linear-gradient(90deg,rgba(201,162,74,.05),rgba(201,162,74,.03))" }}
      >
        <div className="max-w-[1180px] mx-auto px-6 flex justify-between py-7 flex-wrap gap-[22px]">
          {c.stats.map((s) => (
            <div key={s.label} className="text-center flex-1 min-w-[130px] border-l first:border-l-0 border-[rgba(201,162,74,0.20)]">
              <div className="font-display text-[30px] text-[#F2EFE8]">
                {s.value}
                {s.accent && <em className="text-[#C9A24A] not-italic">{s.accent}</em>}
              </div>
              <div className="text-xs text-[#8E8A82] mt-1.5 tracking-[0.05em]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== AI COACH ===== */}
      <section id="coach" className="py-24">
        <div className="max-w-[1180px] mx-auto px-6">
          <SectionHead tag={c.coach.badge} title={c.coach.title} sub={c.coach.subtitle} />

          {/* Trading Coach duo */}
          <div className="grid lg:grid-cols-2 gap-[52px] items-center mt-14">
            <div>
              <div className={`inline-flex items-center gap-2 ${MONO} text-[11px] tracking-[0.18em] text-[#C9A24A] uppercase`}>
                <LineChart size={13} /> {c.coach.tradingTag}
              </div>
              <h3 className="font-display text-[27px] leading-[1.3] mt-3.5">{c.coach.tradingTitle}</h3>
              <p className="text-[#8E8A82] mt-3.5 leading-[1.75] text-[15px]">{c.coach.tradingText}</p>
              <ul className="mt-[18px] text-[14.5px] leading-[2.15] text-[#C9C4B9]">
                {c.coach.tradingBullets.map((t) => (
                  <li key={t}>
                    <span className="text-[#C9A24A] font-bold">✓ </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <Browser url="ultimatradingjournal.com/trading-coach">
              <div className="flex gap-[18px] items-center">
                <div className="relative w-[88px] h-[88px] shrink-0">
                  <svg width="88" height="88" viewBox="0 0 100 100" className="-rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="9" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="#C9A24A"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray="263.9"
                      strokeDashoffset="58"
                    />
                  </svg>
                  <div className={`absolute inset-0 grid place-items-center ${MONO} font-bold text-[22px] text-[#C9A24A]`}>
                    78
                  </div>
                </div>
                <div>
                  <b className="text-[#C9A24A] text-base">{c.coach.tradingFit}</b>
                  <p className="text-[12.5px] mt-1.5 text-[#8E8A82] leading-[1.6]">{c.coach.tradingNote}</p>
                </div>
              </div>
              <div className="mt-[18px] flex flex-col gap-2">
                {c.coach.tradingChecks.map((cc) => (
                  <div
                    key={cc.l}
                    className="flex justify-between items-center bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-[10px] px-3.5 py-2.5 text-[13px]"
                  >
                    {cc.l}
                    <span className={`${MONO} text-[11px] px-2.5 py-[3px] rounded-md ${STATUS_STYLES[cc.s]}`}>
                      {c.coach.statusLabels[cc.s]}
                    </span>
                  </div>
                ))}
              </div>
            </Browser>
          </div>

          {/* Mindset Coach duo */}
          <div className="grid lg:grid-cols-2 gap-[52px] items-center mt-[84px]">
            <Browser url="ultimatradingjournal.com/mindset-coach">
              <div className="flex flex-col gap-3">
                <div className="max-w-[85%] self-end bg-gradient-to-br from-[#E6C873] to-[#A87B2A] text-[#141414] rounded-[14px] rounded-br-[4px] px-4 py-3 text-[13px] leading-[1.65]">
                  {c.coach.mindsetUserMsg}
                </div>
                <div className="max-w-[85%] self-start bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.06)] text-[#D9D4C8] rounded-[14px] rounded-bl-[4px] px-4 py-3 text-[13px] leading-[1.65]">
                  {c.coach.mindsetReply}
                </div>
                <div className="flex gap-2 flex-wrap mt-1">
                  {c.coach.mindsetPrompts.map((p) => (
                    <span
                      key={p}
                      className="text-[11.5px] text-[#8E8A82] border border-[rgba(255,255,255,0.06)] rounded-full px-3 py-1.5"
                    >
                      {p}
                    </span>
                  ))}
                </div>
                <div className="mt-2.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-[10px] px-3.5 py-[11px] text-[12.5px] text-[#8E8A82]">
                  {c.coach.mindsetInput}
                </div>
              </div>
            </Browser>
            <div className="order-first lg:order-none">
              <div className={`inline-flex items-center gap-2 ${MONO} text-[11px] tracking-[0.18em] text-[#C9A24A] uppercase`}>
                <Brain size={13} /> {c.coach.mindsetTag}
              </div>
              <h3 className="font-display text-[27px] leading-[1.3] mt-3.5">{c.coach.mindsetTitle}</h3>
              <p className="text-[#8E8A82] mt-3.5 leading-[1.75] text-[15px]">{c.coach.mindsetText}</p>
              <ul className="mt-[18px] text-[14.5px] leading-[2.15] text-[#C9C4B9]">
                {c.coach.mindsetBullets.map((t) => (
                  <li key={t}>
                    <span className="text-[#C9A24A] font-bold">✓ </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MORE AI + CALENDAR ===== */}
      <section className="pb-24">
        <div className="max-w-[1180px] mx-auto px-6">
          <SectionHead tag={c.moreAi.kicker} title={c.moreAi.title} />
          <div className="grid lg:grid-cols-3 gap-4 mt-11">
            <Browser url="/pre-market-briefing">
              <div className="flex justify-between text-[13px] font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <Sun size={14} className="text-[#C9A24A]" /> {c.moreAi.briefing.title}
                </span>
                <span className={`${MONO} text-[9px] text-[#8E8A82]`}>{c.moreAi.briefing.time}</span>
              </div>
              <p className="text-xs text-[#8E8A82] mt-2.5 leading-[1.6]">
                <b className="text-white">{c.moreAi.briefing.sentimentLabel}</b> {c.moreAi.briefing.sentimentText}
              </p>
              <div className="border border-[rgba(233,79,55,0.3)] bg-[rgba(233,79,55,0.08)] rounded-[10px] px-3 py-2.5 mt-2.5">
                <div className={`${MONO} text-[9px] tracking-[0.14em] text-[#E5484D]`}>
                  {c.moreAi.briefing.impactLabel}
                </div>
                <div className="text-xs mt-1">{c.moreAi.briefing.impactValue}</div>
              </div>
            </Browser>
            <Browser url="/market-news">
              <div className="flex justify-between text-[13px] font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <Newspaper size={14} className="text-[#C9A24A]" /> {c.moreAi.news.title}
                </span>
                <span className={`${MONO} text-[9px] text-[#E5484D]`}>{c.moreAi.news.filter}</span>
              </div>
              <div className="mt-2">
                {c.moreAi.news.rows.map((n) => (
                  <div
                    key={n.c + n.t}
                    className="flex justify-between items-center py-2 border-b border-[rgba(255,255,255,0.05)] text-xs"
                  >
                    <span>
                      <b className={`${MONO} text-[10px] text-[#8E8A82]`}>{n.c}</b>
                      &nbsp; {n.t}
                    </span>
                    <span
                      className={`${MONO} text-[9.5px] px-2 py-0.5 rounded-[5px] ${
                        n.i === "HIGH" ? "text-[#E5484D] bg-[rgba(233,79,55,0.12)]" : "text-[#C9A24A] bg-[rgba(244,185,66,0.12)]"
                      }`}
                    >
                      {n.i}
                    </span>
                  </div>
                ))}
              </div>
            </Browser>
            <Browser url="/pattern-analysis">
              <div className="flex justify-between text-[13px] font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <PieChart size={14} className="text-[#C9A24A]" /> {c.moreAi.patterns.title}
                </span>
                <span className={`${MONO} text-[9px] text-[#8E8A82]`}>{c.moreAi.patterns.range}</span>
              </div>
              <div className="mt-2.5">
                {c.moreAi.patterns.rows.map((p) => (
                  <div
                    key={p.l}
                    className="flex justify-between items-center py-2 border-b border-[rgba(255,255,255,0.05)] text-xs"
                  >
                    <span>{p.l}</span>
                    <b className={p.tone === "up" ? "text-[#3FB68B]" : p.tone === "down" ? "text-[#E5484D]" : ""}>
                      {p.v}
                    </b>
                  </div>
                ))}
              </div>
            </Browser>
          </div>

          {/* Calendar duo */}
          <div className="grid lg:grid-cols-2 gap-[52px] items-center mt-[84px]">
            <div>
              <div className={`inline-flex items-center gap-2 ${MONO} text-[11px] tracking-[0.18em] text-[#C9A24A] uppercase`}>
                <CalendarDays size={13} /> {c.calendar.kicker}
              </div>
              <h3 className="font-display text-[27px] leading-[1.3] mt-3.5">{c.calendar.title}</h3>
              <p className="text-[#8E8A82] mt-3.5 leading-[1.75] text-[15px]">{c.calendar.text}</p>
              <ul className="mt-[18px] text-[14.5px] leading-[2.15] text-[#C9C4B9]">
                {c.calendar.bullets.map((t) => (
                  <li key={t}>
                    <span className="text-[#C9A24A] font-bold">✓ </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <Browser url="ultimatradingjournal.com/calendar">
              <div className="text-[13px] font-semibold">{c.calendar.shotTitle}</div>
              <div className={`${MONO} text-[9.5px] text-[#8E8A82] mt-1`}>{c.calendar.shotLegend}</div>
              <div className="grid grid-cols-7 gap-1.5 mt-3">
                {weekdayInitials.map((d, i) => (
                  <div key={i} className={`${MONO} text-[8.5px] text-[#8E8A82] text-center pb-1`}>
                    {d}
                  </div>
                ))}
                {CAL_DAYS.map((d, i) => (
                  <div
                    key={i}
                    className={`aspect-square rounded-lg grid place-items-center ${MONO} text-[9.5px] border ${
                      d.k
                        ? CAL_DAY_STYLES[d.k]
                        : "bg-[#18181B] border-[rgba(255,255,255,0.05)] text-[#8E8A82]"
                    }`}
                  >
                    {d.d ?? ""}
                  </div>
                ))}
              </div>
            </Browser>
          </div>
        </div>
      </section>

      {/* ===== 16-TOOL GRID ===== */}
      <section id="features" className="pb-24">
        <div className="max-w-[1180px] mx-auto px-6">
          <SectionHead tag={c.features.kicker} title={c.features.title} sub={c.features.subtitle} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
            {c.features.items.map((f) => (
              <div
                key={f.title}
                className="bg-[#121214] border border-[rgba(255,255,255,0.06)] rounded-2xl p-[22px] transition-all duration-200 hover:-translate-y-[5px] hover:border-[rgba(201,162,74,0.4)] hover:shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
              >
                <div className="w-11 h-11 rounded-xl grid place-items-center text-[#C9A24A] mb-3.5 bg-[#18181B] border border-[rgba(201,162,74,0.20)]">
                  {ICON_MAP[f.icon]}
                </div>
                <b className="block text-[15px] font-bold">{f.title}</b>
                <span className="block mt-[7px] text-[12.5px] leading-[1.55] text-[#8E8A82]">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS (placeholder quotes — swap in landingContent.ts) ===== */}
      <section className="pb-24">
        <div className="max-w-[1180px] mx-auto px-6">
          <SectionHead tag={c.testimonials.kicker} title={c.testimonials.title} />
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center mt-[52px]">
            <div
              className="border border-[rgba(201,162,74,0.25)] rounded-[20px] p-[38px]"
              style={{ background: "#121214" }}
            >
              <Stars />
              <div className="text-[21px] leading-[1.6] font-medium mt-4">
                “{c.testimonials.spotlight.pre}
                <span className="text-[#C9A24A]">{c.testimonials.spotlight.hl}</span>
                {c.testimonials.spotlight.post}”
              </div>
              <div className="flex gap-3.5 items-center mt-[26px]">
                <div className="w-[50px] h-[50px] rounded-full bg-[#18181B] border border-[rgba(201,162,74,0.5)] text-[#C9A24A] grid place-items-center font-bold text-lg">
                  {c.testimonials.spotlight.initials}
                </div>
                <div>
                  <b className="block text-[15px]">{c.testimonials.spotlight.name}</b>
                  <small className="text-[#8E8A82]">{c.testimonials.spotlight.role}</small>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3.5">
              {c.testimonials.minis.map((m) => (
                <div
                  key={m.name}
                  className="bg-[#121214] border border-[rgba(255,255,255,0.06)] rounded-[14px] p-5 text-sm leading-[1.65] text-[#C9C4B9] transition-all duration-200 hover:border-[rgba(201,162,74,0.35)] hover:translate-x-1"
                >
                  <Stars />
                  <span className="block mt-1">“{m.quote}”</span>
                  <b className="block mt-2.5 text-[#F2EFE8] text-[12.5px]">— {m.name}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== SHARE CARD ===== */}
      <section
        className="pb-24"
        style={{ background: "linear-gradient(180deg,transparent,rgba(201,162,74,.06),transparent)" }}
      >
        <div className="max-w-[1180px] mx-auto px-6">
          <SectionHead tag={c.share.kicker} title={c.share.title} />
          <div className="grid lg:grid-cols-2 gap-[60px] items-center mt-[52px]">
            <div>
              <h3 className="text-[25px] leading-[1.4] font-bold">{c.share.heading}</h3>
              <p className="text-[#8E8A82] mt-4 leading-[1.75] text-[15px]">{c.share.text}</p>
              <ul className="mt-5 text-[#C9C4B9] text-[14.5px] leading-[2.2]">
                {c.share.bullets.map((b) => (
                  <li key={b}>
                    <span className="text-[#C9A24A] font-bold">— </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="border border-[rgba(201,162,74,0.35)] rounded-[20px] p-7 -rotate-[1.5deg] transition-transform duration-300 hover:rotate-0 hover:scale-[1.02] shadow-[0_30px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]"
              style={{ background: "#121214" }}
            >
              <div className="flex justify-between items-center">
                <div className="flex gap-[9px] items-center text-[11px] tracking-[0.18em] font-bold">
                  <img src={LOGO} alt="" className="w-[26px] h-[26px] rounded-[7px] object-contain" />
                  {c.share.card.brand}
                </div>
                <div className="text-[11px] text-[#8E8A82] tracking-[0.1em]">{c.share.card.month}</div>
              </div>
              <div className="mt-[22px] flex items-baseline gap-3">
                <div className={`${MONO} text-[42px] font-bold text-[#3FB68B]`}>{c.share.card.big}</div>
                <div className={`${MONO} text-base text-[#3FB68B] bg-[rgba(201,162,74,0.1)] border border-[rgba(201,162,74,0.3)] rounded-lg px-2.5 py-[3px]`}>
                  {c.share.card.pct}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5 mt-[22px]">
                {c.share.card.stats.map((s) => (
                  <div key={s.l} className="bg-[rgba(255,255,255,0.04)] rounded-[10px] p-3 text-center">
                    <div className="text-[9.5px] tracking-[0.12em] text-[#8E8A82]">{s.l}</div>
                    <div className={`${MONO} text-base font-bold mt-[5px] ${s.l === "WIN RATE" ? "text-[#3FB68B]" : ""}`}>
                      {s.v}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-[22px] flex justify-between items-center text-[11px] text-[#8E8A82]">
                <span>{c.share.card.handle}</span>
                <span className="text-[#C9A24A]">{c.share.card.url}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== WORKFLOW ===== */}
      <section id="workflow" className="pb-24">
        <div className="max-w-[1180px] mx-auto px-6">
          <SectionHead tag={c.workflow.kicker} title={c.workflow.title} />
          <div className="grid lg:grid-cols-3 gap-[18px] mt-11">
            {c.workflow.steps.map((s) => (
              <div
                key={s.n}
                className="bg-[#121214] border border-[rgba(255,255,255,0.06)] rounded-[18px] p-7 transition-all duration-200 hover:-translate-y-[5px] hover:border-[rgba(201,162,74,0.4)]"
              >
                <div
                  className={`${MONO} font-bold text-[15px] w-11 h-11 rounded-xl grid place-items-center mb-4`}
                  style={STEP_TONES[s.tone]}
                >
                  {s.n}
                </div>
                <b className="text-[16.5px]">{s.title}</b>
                <p className="text-[#8E8A82] text-sm leading-[1.7] mt-[9px]">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="pb-24">
        <div className="max-w-[1180px] mx-auto px-6">
          <SectionHead tag={c.pricing.kicker} title={c.pricing.title} sub={c.pricing.subtitle} />
          <div className="flex justify-center mt-[34px]">
            <div className="flex bg-[#121214] border border-[rgba(255,255,255,0.06)] rounded-xl p-[5px] gap-1">
              <button
                type="button"
                onClick={() => setBilling("mo")}
                className={`text-sm font-semibold px-6 py-2.5 rounded-[9px] transition-all duration-200 ${
                  !isYr ? "bg-gradient-to-br from-[#E6C873] to-[#A87B2A] text-[#141414]" : "text-[#8E8A82]"
                }`}
              >
                {c.pricing.toggle.monthly}
              </button>
              <button
                type="button"
                onClick={() => setBilling("yr")}
                className={`text-sm font-semibold px-6 py-2.5 rounded-[9px] transition-all duration-200 ${
                  isYr ? "bg-gradient-to-br from-[#E6C873] to-[#A87B2A] text-[#141414]" : "text-[#8E8A82]"
                }`}
              >
                {c.pricing.toggle.yearly} <span className="text-[11.5px] ml-1 opacity-85">{c.pricing.toggle.save}</span>
              </button>
            </div>
          </div>
          <div className="grid lg:grid-cols-3 gap-5 mt-10 max-w-[420px] lg:max-w-none mx-auto">
            {c.pricing.plans.map((p) => {
              const amt = isYr && p.priceYearly ? p.priceYearly : p.price;
              const per = isYr && p.perYearly ? p.perYearly : p.per;
              const was = isYr && p.wasYearly ? p.wasYearly : p.was;
              return (
                <div
                  key={p.id}
                  className={`relative rounded-[20px] p-8 transition-all duration-200 hover:-translate-y-1.5 ${
                    p.featured
                      ? "border border-[rgba(201,162,74,0.5)] shadow-[0_26px_80px_rgba(201,162,74,0.18)]"
                      : "bg-[#121214] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(201,162,74,0.4)]"
                  }`}
                  style={p.featured ? { background: "#121214" } : undefined}
                >
                  {p.badge && (
                    <span className="absolute -top-[13px] left-1/2 -translate-x-1/2 bg-gradient-to-br from-[#E6C873] to-[#A87B2A] text-[11px] font-bold tracking-[0.08em] px-4 py-1.5 rounded-full text-[#0A0A0B] whitespace-nowrap">
                      {p.badge}
                    </span>
                  )}
                  <h4 className={`${MONO} text-[12.5px] tracking-[0.16em] text-[#8E8A82]`}>{p.name}</h4>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className={`${MONO} text-[40px] font-bold`}>{amt}</span>
                    <span className="text-[#8E8A82] text-[13px]">{per}</span>
                  </div>
                  <div className={`min-h-[19px] mt-1 flex items-center gap-2 ${MONO} text-[13px]`}>
                    {was && <span className="text-[#8E8A82] line-through">{was}</span>}
                    {p.saveNote && (
                      <span className="text-[#C9A24A] bg-[rgba(201,162,74,0.08)] border border-[rgba(201,162,74,0.35)] rounded-md px-2 py-0.5 text-[10.5px] no-underline">
                        {p.saveNote}
                      </span>
                    )}
                  </div>
                  <ul className="mt-5 text-[14.5px] leading-[2.25] text-[#C9C4B9]">
                    {p.bullets.map((b) => (
                      <li key={b}>
                        <span className="text-[#C9A24A] font-bold">✓ </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  <SignUpButton mode="modal">
                    <button className={`${p.featured ? BTN_PRIMARY : BTN_GHOST} w-full mt-6`}>{p.cta}</button>
                  </SignUpButton>
                </div>
              );
            })}
          </div>
          <div className="text-center text-[#8E8A82] text-[13px] mt-6">{c.pricing.footnote}</div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="pb-24">
        <div className="max-w-[1180px] mx-auto px-6">
          <SectionHead tag={c.faq.kicker} title={c.faq.title} />
          <div className="max-w-[760px] mx-auto mt-11 flex flex-col border-t border-[rgba(255,255,255,0.08)]">
            {c.faq.items.map(([q, a], i) => (
              <details
                key={q}
                open={i === 0}
                className="lp-faq border-b border-[rgba(255,255,255,0.08)] px-1"
              >
                <summary className="flex justify-between items-center py-[18px] font-semibold text-[15px]">
                  {q}
                </summary>
                <p className="text-[#8E8A82] text-sm leading-[1.7] pb-[18px]">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <div className="max-w-[1180px] mx-auto px-6">
        <div
          className="border border-[rgba(255,255,255,0.06)] rounded-3xl text-center px-[30px] py-[66px] mb-20"
          style={{ background: "linear-gradient(135deg,rgba(201,162,74,.15),rgba(201,162,74,.1))" }}
        >
          <div className={`${MONO} text-[11px] tracking-[0.28em] text-[#C9A24A] font-semibold uppercase`}>
            {c.finalCta.kicker}
          </div>
          <h2 className="font-display text-[clamp(30px,3.8vw,42px)] tracking-[-0.01em] mt-3 leading-[1.25]">
            {c.finalCta.titleA}
            <br />
            {c.finalCta.titleB}
          </h2>
          <p className="text-[#8E8A82] mt-3.5 max-w-[560px] mx-auto leading-[1.7]">{c.finalCta.subtitle}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3.5">
            <SignUpButton mode="modal">
              <button className={`${BTN_PRIMARY} px-[34px] py-4 text-[15px]`}>
                {c.finalCta.cta} <ArrowRight size={15} strokeWidth={2.5} />
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className={`${BTN_GHOST} px-[34px] py-4 text-[15px]`}>{c.cta.haveAccount}</button>
            </SignInButton>
          </div>
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-[rgba(255,255,255,0.06)] py-8 text-[#8E8A82] text-[13px]">
        <div className="max-w-[1180px] mx-auto px-6">
          <p className="mb-3 text-[12.5px] text-[#8E8A82]/80">{c.footer.blurb}</p>
          <div className="flex justify-between flex-wrap gap-2">
            <span>
              © {yearRef.current} {c.footer.rights}
            </span>
            <span>{c.footer.secured}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
