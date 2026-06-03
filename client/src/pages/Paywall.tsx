// Subscription paywall / pricing screen.
//
// Shown to authenticated users who do NOT have an active or trialing
// subscription. Also reachable directly at /pricing. Reuses the Ocean Depth
// Premium look from the Landing page and funnels the user into Stripe Checkout
// (subscription mode, 7-day free trial).

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2, ShieldCheck, LogOut } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const HERO_BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663576082454/8kEKtsKWxF9JiwbjRbrvBM/titans-hero-bg-oSsnHtDa4d4m94aQURkp85.webp";

const FEATURES = [
  "Unlimited trading accounts & journals",
  "MT5 / MT4 auto-sync with monthly breakdown",
  "Per-month KPIs, equity curve, win rate, drawdown",
  "Excel import & export, TradingView chart links",
  "Private by default — your data, your workspace",
];

export default function Paywall() {
  const { logout } = useAuth();
  const planQuery = trpc.subscription.plan.useQuery();
  const [redirecting, setRedirecting] = useState(false);

  const checkout = trpc.subscription.createCheckout.useMutation({
    onSuccess: ({ url }) => {
      toast.success("Redirecting to secure checkout…");
      window.location.href = url;
    },
    onError: (err) => {
      setRedirecting(false);
      toast.error(err.message || "Could not start checkout");
    },
  });

  const plan = planQuery.data;
  const price = plan?.displayPrice ?? "€29.99";
  const trialDays = plan?.trialDays ?? 7;

  function startTrial() {
    setRedirecting(true);
    checkout.mutate({ origin: window.location.origin });
  }

  return (
    <div className="min-h-screen bg-[#070F1C] text-white relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${HERO_BG})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#070F1C]/40 via-[#070F1C]/70 to-[#070F1C]" />

      <header className="relative max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663576082454/8kEKtsKWxF9JiwbjRbrvBM/utj-logo-badge-N5NDtvx9GcDyhxwM7gRvFA.webp"
            alt="Ultimate Trading Journal"
            className="w-8 h-8 rounded-lg object-contain"
          />
          <div>
            <div className="font-['Space_Grotesk'] font-semibold text-sm tracking-wide">
              ULTIMATE
            </div>
            <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-[0.12em]">
              TRADING JOURNAL
            </div>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-white/70 hover:text-white transition-colors"
        >
          <LogOut size={12} /> Sign out
        </button>
      </header>

      <main className="relative max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-2xl mx-auto"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#0094C6] mb-4">
            Start your {trialDays}-day free trial
          </div>
          <h1 className="font-['Space_Grotesk'] font-semibold text-3xl sm:text-4xl md:text-5xl leading-[1.08] tracking-tight">
            Unlock the full journal.
          </h1>
          <p className="mt-4 text-white/70 text-base leading-relaxed">
            Try everything free for {trialDays} days. Then just {price}/month.
            Cancel anytime — no questions asked.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-12 max-w-md mx-auto rounded-2xl border border-white/10 bg-[#0D1E35]/80 backdrop-blur p-8 shadow-2xl shadow-black/40"
        >
          <div className="flex items-baseline gap-2">
            <span className="font-['Space_Grotesk'] font-bold text-5xl">{price}</span>
            <span className="font-mono text-sm text-[#4A6080]">/ month</span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-[#00B4D8] uppercase tracking-wider">
            {trialDays} days free, then billed monthly
          </div>

          <ul className="mt-6 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-white/85">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-[#0094C6]/20 text-[#00B4D8] flex items-center justify-center shrink-0">
                  <Check size={12} strokeWidth={3} />
                </span>
                {f}
              </li>
            ))}
          </ul>

          <button
            onClick={startTrial}
            disabled={redirecting || checkout.isPending || planQuery.isLoading}
            className="mt-8 w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] rounded-xl text-xs font-mono font-semibold uppercase tracking-wider shadow-lg shadow-[#0094C6]/25 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {redirecting || checkout.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Redirecting…
              </>
            ) : (
              <>
                Start {trialDays}-day free trial
                <ArrowRight size={14} strokeWidth={3} />
              </>
            )}
          </button>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] font-mono text-[#4A6080] uppercase tracking-widest">
            <ShieldCheck size={12} /> Secure checkout by Stripe
          </div>

          {plan && !plan.configured && (
            <div className="mt-4 text-center text-[11px] font-mono text-[#F4A261]">
              Payments are not fully configured yet. Add Stripe keys in Settings → Payment.
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
