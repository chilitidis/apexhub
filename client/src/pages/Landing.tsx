// Landing page shown to signed-out visitors when Clerk is active.
// Keeps the APEXHUB design language (deep navy, ocean blue accents) and funnels
// every visitor toward Clerk's SignIn / SignUp modals (email + Google).

import { SignInButton, SignUpButton } from "@clerk/clerk-react";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, LineChart, Shield } from "lucide-react";

const HERO_BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663576082454/8kEKtsKWxF9JiwbjRbrvBM/titans-hero-bg-oSsnHtDa4d4m94aQURkp85.webp";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#070F1C] text-white relative overflow-hidden">
      {/* Background texture */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${HERO_BG})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#070F1C]/40 via-[#070F1C]/70 to-[#070F1C]" />

      {/* Top bar */}
      <header className="relative max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/manus-storage/apexhub-logo_a1e39f31.png"
            alt="ApexHub"
            className="w-8 h-8 rounded-lg object-contain"
          />
          <div>
            <div className="font-['Space_Grotesk'] font-semibold text-sm tracking-wide">
              APEXHUB
            </div>
            <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-[0.12em]">
              TRADING JOURNAL
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SignInButton mode="modal">
            <button className="px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-white/80 hover:text-white transition-colors">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider shadow-lg shadow-[#0094C6]/20">
              Create account
              <ArrowRight size={12} strokeWidth={3} />
            </button>
          </SignUpButton>
        </div>
      </header>

      {/* Hero */}
      <main className="relative max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#0094C6] mb-4">
            Your private trading journal
          </div>
          <h1 className="font-['Space_Grotesk'] font-semibold text-4xl sm:text-5xl md:text-6xl leading-[1.05] tracking-tight text-white">
            Track every trade.
            <br />
            <span className="text-[#0094C6]">Own</span> every insight.
          </h1>
          <p className="mt-5 max-w-2xl text-white/70 text-base sm:text-lg leading-relaxed">
            APEXHUB is a personal trading journal for serious traders. Sign up
            with email or Google, import your MT5 journal or start from zero,
            and keep every trade, chart, and KPI in your own private workspace.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <SignUpButton mode="modal">
              <button className="flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] rounded-xl text-xs font-mono font-semibold uppercase tracking-wider shadow-lg shadow-[#0094C6]/25">
                Create free account
                <ArrowRight size={14} strokeWidth={3} />
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="px-5 py-3 border border-white/10 hover:border-white/30 rounded-xl text-xs font-mono font-semibold uppercase tracking-wider text-white/80 hover:text-white transition-all">
                I already have an account
              </button>
            </SignInButton>
          </div>
        </motion.div>

        {/* Feature trio */}
        <div className="relative mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: <BarChart3 size={18} />,
              title: "Journal per month",
              text: "Snapshot each month with KPIs, equity curve, win rate, and max drawdown.",
            },
            {
              icon: <LineChart size={18} />,
              title: "Import from MT5",
              text: "Drop your APEXHUB-format Excel or paste TradingView links to hydrate an entire month.",
            },
            {
              icon: <Shield size={18} />,
              title: "Private by default",
              text: "Your trades are scoped to your account. Other users never see your data.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-white/10 bg-[#0D1E35]/70 backdrop-blur p-5"
            >
              <div className="w-8 h-8 rounded-lg bg-[#0094C6]/15 text-[#0094C6] flex items-center justify-center mb-3">
                {f.icon}
              </div>
              <div className="font-['Space_Grotesk'] font-semibold text-sm">
                {f.title}
              </div>
              <p className="mt-2 text-white/70 text-xs leading-relaxed">
                {f.text}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-[#4A6080] uppercase tracking-widest">
        <span>APEXHUB · Trading Journal</span>
        <span>Secured by Clerk</span>
      </footer>
    </div>
  );
}
