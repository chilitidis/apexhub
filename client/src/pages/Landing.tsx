// Public marketing landing page shown to signed-out visitors (Clerk active).
// Ocean Depth Premium design language. Bilingual EN/EL via LANDING_CONTENT — all
// copy comes from client/src/lib/landingContent.ts. Core trading terms stay in
// English in both languages. Funnels visitors to Clerk SignIn / SignUp modals.

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
  Sparkles,
  Send,
  Mic,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LANDING_CONTENT } from "@/lib/landingContent";
import { LanguageToggle } from "@/components/LanguageToggle";

const LOGO =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663576082454/8kEKtsKWxF9JiwbjRbrvBM/utj-logo-badge-N5NDtvx9GcDyhxwM7gRvFA.webp";

// Resolve a feature icon key (from landingContent.ts) to a rendered icon.
const ICON_MAP: Record<string, React.ReactNode> = {
  BarChart3: <BarChart3 size={20} />,
  Activity: <Activity size={20} />,
  Brain: <Brain size={20} />,
  Sun: <Sun size={20} />,
  Newspaper: <Newspaper size={20} />,
  PieChart: <PieChart size={20} />,
  RefreshCw: <RefreshCw size={20} />,
  CalendarDays: <CalendarDays size={20} />,
  FileSpreadsheet: <FileSpreadsheet size={20} />,
  Calculator: <Calculator size={20} />,
  Wallet: <Wallet size={20} />,
  ShieldCheck: <ShieldCheck size={20} />,
};

const TONE_MAP: Record<string, string> = {
  ocean: "bg-[#0094C6]/15 text-[#00B4D8]",
  gold: "bg-[#F4A261]/15 text-[#F4A261]",
  profit: "bg-[#00C2A0]/15 text-[#00C2A0]",
  violet: "bg-[#9B7BE0]/15 text-[#9B7BE0]",
  loss: "bg-[#E94F37]/15 text-[#E94F37]",
};

// ===== Scroll-reveal hook =====
// `dep` re-runs the observer setup (e.g. on language change) so newly
// re-rendered .lp-fade nodes are re-observed and revealed again instead of
// being stuck at opacity:0 ("disappearing cards" bug on language toggle).
function useScrollReveal(dep?: unknown) {
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
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(".lp-fade"),
    );
    els.forEach((el) => {
      // Anything already within (or above) the viewport should be visible
      // immediately to avoid a flash of empty space during re-render.
      const rect = el.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (inView || el.classList.contains("lp-in")) {
        el.classList.add("lp-in");
      } else {
        io.observe(el);
      }
    });
    return () => io.disconnect();
  }, [dep]);
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

// Calendar mock data (locale-independent numbers)
const CAL_DAYS = [
  { n: 2, pl: 210 }, { n: 3, pl: -90 }, { n: 4, pl: 540 }, { n: 5, pl: 120 }, { n: 6, pl: 0 }, { n: 7, empty: true }, { n: 8, empty: true },
  { n: 9, pl: 330 }, { n: 10, pl: 95 }, { n: 11, pl: -240 }, { n: 12, pl: 410 }, { n: 13, pl: 180 }, { n: 14, empty: true }, { n: 15, empty: true },
  { n: 16, pl: 0 }, { n: 17, pl: 760 }, { n: 18, pl: 240 }, { n: 19, pl: -110 }, { n: 20, pl: 0 }, { n: 21, empty: true }, { n: 22, empty: true },
] as Array<{ n: number; pl?: number; empty?: boolean }>;

export default function Landing() {
  const { lang } = useLanguage();
  useScrollReveal(lang);
  const yearRef = useRef(new Date().getFullYear());
  const c = LANDING_CONTENT[lang];

  const navLinks = [
    { href: "#coach", label: c.nav.coach },
    { href: "#features", label: c.nav.features },
    { href: "#workflow", label: c.nav.workflow },
    { href: "#pricing", label: c.nav.pricing },
    { href: "#faq", label: c.nav.faq },
  ];

  // Weekday initials for the calendar mock — Monday-first.
  const weekdayInitials =
    lang === "el"
      ? ["Δ", "Τ", "Τ", "Π", "Π", "Σ", "Κ"]
      : ["M", "T", "W", "T", "F", "S", "S"];

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
            {navLinks.map((l) => (
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
            <LanguageToggle />
            <SignInButton mode="modal">
              <button className="px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-white/80 hover:text-white transition-colors">
                {c.cta.signIn}
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider shadow-lg shadow-[#0094C6]/20">
                {c.cta.start} <ArrowRight size={12} strokeWidth={3} />
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
              {c.hero.badge}
            </span>
            <h1 className="font-semibold text-4xl sm:text-6xl md:text-7xl leading-[1.02] tracking-tight">
              {c.hero.titleA}
              <br />
              <span className="bg-gradient-to-br from-[#00B4D8] to-[#0094C6] bg-clip-text text-transparent">
                {c.hero.titleHighlight}
              </span>{" "}
              {c.hero.titleB}
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-[#8AA0BE] text-base sm:text-xl leading-relaxed">
              {c.hero.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
              <SignUpButton mode="modal">
                <button className="flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] rounded-xl text-xs font-mono font-semibold uppercase tracking-wider shadow-lg shadow-[#0094C6]/25 transition-all hover:-translate-y-0.5">
                  {c.hero.ctaPrimary} <ArrowRight size={14} strokeWidth={3} />
                </button>
              </SignUpButton>
              <a
                href="#coach"
                className="px-5 py-3 border border-white/15 hover:border-white/40 rounded-xl text-xs font-mono font-semibold uppercase tracking-wider text-white/80 hover:text-white transition-all"
              >
                {c.hero.ctaSecondary}
              </a>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-6 text-xs font-mono text-[#4A6080]">
              <span className="inline-flex items-center gap-1.5">
                <Check size={13} className="text-[#00C2A0]" /> {c.hero.check1}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={13} className="text-[#00C2A0]" /> {c.hero.check2}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={13} className="text-[#00C2A0]" /> {c.hero.check3}
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
                    {c.hero.shotEquity}
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
                    {c.hero.shotRecent}
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
            {c.statsCaption}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {c.stats.map((s) => (
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
              <Sparkles size={13} /> {c.coach.badge}
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
              {c.coach.title}
            </h2>
            <p className="text-[#8AA0BE] text-lg">{c.coach.subtitle}</p>
          </div>

          {/* Trading Coach */}
          <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center mb-24">
            <div className="lp-fade">
              <div className="inline-flex items-center gap-2 text-[#00C2A0] font-mono text-[11px] uppercase tracking-[0.18em] mb-3.5">
                <Activity size={14} /> {c.coach.tradingTag}
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3.5 leading-tight">
                {c.coach.tradingTitle}
              </h3>
              <p className="text-[#8AA0BE] text-base leading-relaxed mb-5">
                {c.coach.tradingText}
              </p>
              <ul className="flex flex-col gap-3">
                {c.coach.tradingBullets.map((t) => (
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
                      {c.coach.tradingFit}
                    </div>
                    <div className="text-[13px] text-white/85 leading-snug">
                      <span className="font-mono text-[#8AA0BE]">XAUUSD · H1 · </span>
                      <span className="font-semibold text-[#00C2A0]">LONG</span>
                      <span className="font-mono text-[#8AA0BE]"> · RR 1:2.4</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0F2440] p-3 mb-3 text-[12px] text-[#A8B5C7] leading-relaxed">
                  {c.coach.tradingNote}
                </div>
                <div className="flex flex-col gap-1.5">
                  {c.coach.tradingChecks.map((cc) => (
                    <div key={cc.l} className="flex items-center gap-2.5 text-[12px]">
                      <span
                        className="w-5 h-5 rounded-md grid place-items-center text-[11px] font-bold shrink-0"
                        style={{
                          background:
                            cc.s === "ok"
                              ? "rgba(0,137,123,0.15)"
                              : cc.s === "warn"
                                ? "rgba(244,162,97,0.15)"
                                : "rgba(233,79,55,0.15)",
                          color:
                            cc.s === "ok"
                              ? "#00C896"
                              : cc.s === "warn"
                                ? "#F4A261"
                                : "#E94F37",
                        }}
                      >
                        {cc.s === "ok" ? (
                          <Check size={11} />
                        ) : cc.s === "warn" ? (
                          <Minus size={11} />
                        ) : (
                          <X size={11} />
                        )}
                      </span>
                      <span className="text-white/85">{cc.l}</span>
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
                      {c.coach.mindsetMe}
                    </span>
                    <div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12.5px] bg-[#0077B6]/15 text-[#E6EEF8]">
                      {c.coach.mindsetUserMsg}
                    </div>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="shrink-0 w-7 h-7 rounded-lg grid place-items-center bg-[#5E60CE]/15 text-[#9B7BE0]">
                      <Brain size={14} />
                    </span>
                    <div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12.5px] bg-[#0D1E35] border border-white/10 text-[#D6DEEA] leading-relaxed">
                      {c.coach.mindsetReply}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {c.coach.mindsetPrompts.map((p) => (
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
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 rounded-xl border border-white/10 bg-[#0F2440] px-3 py-2 text-[11px] text-[#4A6080]">
                      {c.coach.mindsetInput}
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
                <Brain size={14} /> {c.coach.mindsetTag}
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3.5 leading-tight">
                {c.coach.mindsetTitle}
              </h3>
              <p className="text-[#8AA0BE] text-base leading-relaxed mb-5">
                {c.coach.mindsetText}
              </p>
              <ul className="flex flex-col gap-3">
                {c.coach.mindsetBullets.map((t) => (
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
              {c.moreAi.kicker}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-3.5">
              {c.moreAi.title}
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
                  Risk-on · DXY softer pre-CPI.
                </p>
                <div className="rounded-lg border border-[#E94F37]/30 bg-[#E94F37]/10 p-2.5">
                  <div className="font-mono text-[9px] tracking-wider text-[#E94F37] mb-1">
                    HIGH IMPACT TODAY
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
                    Win rate / setup
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
                {c.calendar.kicker}
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold mt-3.5 mb-3.5 leading-tight">
                {c.calendar.title}
              </h3>
              <p className="text-[#8AA0BE] text-base leading-relaxed mb-5">
                {c.calendar.text}
              </p>
              <ul className="flex flex-col gap-3">
                {c.calendar.bullets.map((t) => (
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
                  {c.calendar.shotTitle}
                </h4>
                <p className="text-[10px] text-[#8AA0BE] mb-3 font-mono">
                  {c.calendar.shotLegend}
                </p>
                <div className="grid grid-cols-7 gap-1.5">
                  {weekdayInitials.map((d, i) => (
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
              {c.features.kicker}
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mt-3.5 mb-4">
              {c.features.title}
            </h2>
            <p className="text-[#8AA0BE] text-lg">{c.features.subtitle}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {c.features.items.map((f) => (
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
                  {ICON_MAP[f.icon]}
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
              {c.workflow.kicker}
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mt-3.5">
              {c.workflow.title}
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {c.workflow.steps.map((s) => (
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
              {c.pricing.kicker}
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mt-3.5 mb-4">
              {c.pricing.title}
            </h2>
            <p className="text-[#8AA0BE] text-lg">{c.pricing.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 max-w-[420px] md:max-w-none mx-auto items-stretch">
            {c.pricing.plans.map((p) => (
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
                  {c.pricing.includes.map((inc) => (
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
            {c.pricing.footnote}
          </p>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="lp-fade text-center max-w-2xl mx-auto mb-12">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#0094C6]">
              {c.faq.kicker}
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mt-3.5">
              {c.faq.title}
            </h2>
          </div>
          <div className="max-w-[760px] mx-auto flex flex-col gap-3">
            {c.faq.items.map(([q, a], i) => (
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
              {c.finalCta.title}
            </h2>
            <p className="relative text-[#8AA0BE] text-lg max-w-xl mx-auto mb-7">
              {c.finalCta.subtitle}
            </p>
            <div className="relative flex flex-wrap justify-center gap-3.5">
              <SignUpButton mode="modal">
                <button className="flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] rounded-xl text-xs font-mono font-semibold uppercase tracking-wider shadow-lg shadow-[#0094C6]/25 transition-all hover:-translate-y-0.5">
                  {c.cta.createAccount} <ArrowRight size={14} strokeWidth={3} />
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button className="px-5 py-3 border border-white/15 hover:border-white/40 rounded-xl text-xs font-mono font-semibold uppercase tracking-wider text-white/80 hover:text-white transition-all">
                  {c.cta.haveAccount}
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
                {c.footer.blurb}
              </p>
            </div>
            <div>
              <h5 className="font-mono text-xs uppercase tracking-[0.12em] text-[#4A6080] mb-3.5">
                {c.footer.product}
              </h5>
              {navLinks.map((l) => (
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
                {c.footer.account}
              </h5>
              <SignInButton mode="modal">
                <button className="block text-[#8AA0BE] text-[13px] mb-2.5 hover:text-white transition-colors">
                  {c.cta.signIn}
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="block text-[#8AA0BE] text-[13px] mb-2.5 hover:text-white transition-colors">
                  {c.cta.createAccount}
                </button>
              </SignUpButton>
            </div>
          </div>
          <div className="mt-9 pt-5 border-t border-white/10 flex flex-wrap justify-between gap-2.5 font-mono text-[11px] text-[#4A6080] uppercase tracking-wider">
            <span>© {yearRef.current} {c.footer.rights}</span>
            <span>{c.footer.secured}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
