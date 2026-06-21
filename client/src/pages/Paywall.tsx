// Subscription paywall / pricing screen.
//
// Shown to authenticated users who do NOT have an active or trialing
// subscription. Also reachable directly at /pricing. Reuses the Ocean Depth
// Premium look from the Landing page and funnels the user into Stripe Checkout
// (subscription mode, 7-day free trial).
//
// Now supports three billing plans: Monthly, 6-month (save 1 month) and
// 12-month (save 2 months). The user picks a plan, then starts the trial.

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, Loader2, ShieldCheck, LogOut, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useLanguage } from "@/contexts/LanguageContext";

// Statuses that mean the user previously had a subscription but currently owes
// money / has lapsed. These users are LOCKED out of the app and may only reach
// this page to pay. We show them a distinct "reactivate" message.
const LOCKED_STATUSES = new Set(["past_due", "unpaid", "canceled", "incomplete", "incomplete_expired"]);

const HERO_BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663576082454/8kEKtsKWxF9JiwbjRbrvBM/titans-hero-bg-oSsnHtDa4d4m94aQURkp85.webp";

type PlanId = "monthly" | "semiannual" | "annual";

export default function Paywall() {
  const { logout } = useAuth();
  const { t } = useLanguage();
  const FEATURES = [t("pw.feat1"), t("pw.feat2"), t("pw.feat3"), t("pw.feat4"), t("pw.feat5")];
  const PLAN_SUBTITLE: Record<PlanId, string> = {
    monthly: t("pw.billMonthly"),
    semiannual: t("pw.billSemiannual"),
    annual: t("pw.billAnnual"),
  };
  const [, setLocation] = useLocation();
  const { status: subStatus, hasAccess, isAdmin } = useSubscription();
  const plansQuery = trpc.subscription.plans.useQuery();

  // "Locked" = a logged-in, non-admin user who currently has no access AND whose
  // status indicates a lapsed/owed subscription (vs. a brand-new "none" user).
  // Locked users must not see an escape hatch back into the gated app.
  const isLocked = !hasAccess && !isAdmin && LOCKED_STATUSES.has(subStatus);
  const [redirecting, setRedirecting] = useState(false);
  // Tracks which CTA triggered the redirect so we can show the right spinner.
  const [redirectMode, setRedirectMode] = useState<"trial" | "now" | null>(null);
  const [selected, setSelected] = useState<PlanId>("annual");

  const checkout = trpc.subscription.createCheckout.useMutation({
    onSuccess: ({ url }) => {
      toast.success(t("pw.redirectToast"));
      window.location.href = url;
    },
    onError: (err) => {
      setRedirecting(false);
      setRedirectMode(null);
      toast.error(err.message || t("pw.checkoutError"));
    },
  });

  const trialDays = plansQuery.data?.trialDays ?? 7;
  const configured = plansQuery.data?.configured ?? true;

  const plans = useMemo(
    () => (plansQuery.data?.plans ?? []).filter((p) => p.available),
    [plansQuery.data],
  );

  // Ensure the selected plan is always one that's actually available.
  const effectiveSelected: PlanId = useMemo(() => {
    if (plans.some((p) => p.id === selected)) return selected;
    if (plans.some((p) => p.id === "annual")) return "annual";
    return (plans[0]?.id as PlanId) ?? "monthly";
  }, [plans, selected]);

  const current = plans.find((p) => p.id === effectiveSelected);

  function startTrial() {
    setRedirecting(true);
    setRedirectMode("trial");
    checkout.mutate({ origin: window.location.origin, plan: effectiveSelected, withTrial: true });
  }

  function payNow() {
    setRedirecting(true);
    setRedirectMode("now");
    checkout.mutate({ origin: window.location.origin, plan: effectiveSelected, withTrial: false });
  }

  return (
    <div className="min-h-screen lg:h-screen overflow-y-auto lg:overflow-hidden bg-[#070F1C] text-white relative flex flex-col">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${HERO_BG})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#070F1C]/40 via-[#070F1C]/70 to-[#070F1C]" />

      <header className="relative max-w-[1100px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Back-to-dashboard is hidden for locked (past_due/unpaid/canceled)
              users — there is nowhere for them to go until they pay. */}
          {!isLocked && (
            <button
              onClick={() => setLocation("/")}
              aria-label={t("pw.back")}
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          {isLocked ? (
            <div className="flex items-center gap-3 px-1 py-1">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663576082454/8kEKtsKWxF9JiwbjRbrvBM/utj-logo-badge-N5NDtvx9GcDyhxwM7gRvFA.webp"
                alt="Ultimate Trading Journal"
                className="w-8 h-8 rounded-lg object-contain"
              />
              <div className="text-left">
                <div className="font-['Space_Grotesk'] font-semibold text-sm tracking-wide">
                  ULTIMATE
                </div>
                <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-[0.12em]">
                  TRADING JOURNAL
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setLocation("/")}
              aria-label="Ultimate Trading Journal — dashboard"
              className="flex items-center gap-3 group rounded-lg -mx-1 px-1 py-1 hover:bg-white/5 transition-colors"
            >
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663576082454/8kEKtsKWxF9JiwbjRbrvBM/utj-logo-badge-N5NDtvx9GcDyhxwM7gRvFA.webp"
                alt="Ultimate Trading Journal"
                className="w-8 h-8 rounded-lg object-contain"
              />
              <div className="text-left">
                <div className="font-['Space_Grotesk'] font-semibold text-sm tracking-wide group-hover:text-[#48CAE4] transition-colors">
                  ULTIMATE
                </div>
                <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-[0.12em]">
                  TRADING JOURNAL
                </div>
              </div>
            </button>
          )}
        </div>
        <button
          onClick={() => logout()}
          className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-white/70 hover:text-white transition-colors"
        >
          <LogOut size={12} /> {t("pw.signOut")}
        </button>
      </header>

      <main className="relative w-full max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 flex-1 min-h-0 flex flex-col justify-start lg:justify-center pb-8 lg:pb-4">
        {isLocked && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            role="alert"
            className="mb-5 max-w-2xl mx-auto w-full flex items-start gap-3 rounded-xl border border-[#E94F37]/40 bg-[#E94F37]/10 px-4 py-3"
          >
            <AlertTriangle size={18} className="text-[#E94F37] shrink-0 mt-0.5" />
            <div className="text-left">
              <div className="font-['Space_Grotesk'] font-semibold text-sm text-[#FF8A75]">
                {subStatus === "canceled"
                  ? t("pw.lockedCanceledTitle")
                  : t("pw.lockedPastDueTitle")}
              </div>
              <div className="mt-0.5 text-[12px] leading-snug text-white/75">
                {subStatus === "canceled"
                  ? t("pw.lockedCanceledBody")
                  : t("pw.lockedPastDueBody")}
              </div>
            </div>
          </motion.div>
        )}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-2xl mx-auto"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#0094C6] mb-3">
            {isLocked ? t("pw.reactivateKicker") : t("pw.trialKicker").replace("{days}", String(trialDays))}
          </div>
          <h1 className="font-['Space_Grotesk'] font-semibold text-3xl sm:text-4xl leading-[1.08] tracking-tight">
            {isLocked ? t("pw.lockedHeadline") : t("pw.headline")}
          </h1>
          <p className="mt-3 text-white/70 text-sm sm:text-base leading-relaxed">
            {isLocked
              ? t("pw.lockedSub")
              : t("pw.sub").replace("{days}", String(trialDays))}
          </p>
        </motion.div>

        {/* Plan selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 grid grid-cols-3 gap-2 sm:gap-3 max-w-3xl mx-auto"
        >
          {plansQuery.isLoading && (
            <div className="col-span-full flex justify-center py-10">
              <Loader2 className="animate-spin text-[#0094C6]" />
            </div>
          )}
          {plans.map((p) => {
            const isActive = p.id === effectiveSelected;
            const planName =
              p.id === "monthly"
                ? t("pw.planMonthly")
                : p.id === "semiannual"
                  ? t("pw.planSemiannual")
                  : t("pw.planAnnual");
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.id as PlanId)}
                className={`relative text-left rounded-xl sm:rounded-2xl border transition-all p-2.5 sm:p-5 ${
                  isActive
                    ? "border-[#0094C6] bg-[#0D1E35] shadow-lg shadow-[#0094C6]/20"
                    : "border-white/10 bg-[#0D1E35]/60 hover:border-white/25"
                }`}
              >
                {p.badge && (
                  <span className="absolute -top-2 right-1.5 sm:right-3 px-1.5 sm:px-2 py-0.5 rounded-full bg-[#00897B] text-white text-[7px] sm:text-[9px] font-mono font-bold uppercase tracking-wider whitespace-nowrap">
                    {p.badge}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[8px] sm:text-[10px] uppercase tracking-widest text-[#4A6080]">
                    {planName}
                  </span>
                  <span
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 rounded-full border flex items-center justify-center ${
                      isActive ? "border-[#0094C6] bg-[#0094C6]" : "border-white/30"
                    }`}
                  >
                    {isActive && <Check size={9} strokeWidth={3} className="text-white" />}
                  </span>
                </div>
                <div className="mt-2 sm:mt-3 font-['Space_Grotesk'] font-bold text-base sm:text-2xl leading-tight">
                  {p.displayPrice}
                </div>
                <div className="mt-0.5 sm:mt-1 font-mono text-[8px] sm:text-[10px] text-[#4A6080] leading-snug">
                  {PLAN_SUBTITLE[p.id as PlanId]}
                </div>
                {p.intervalMonths > 1 && (
                  <div className="mt-1 sm:mt-2 font-mono text-[8px] sm:text-[10px] text-[#00B4D8]">
                    ≈ {p.perMonthDisplay}{t("pw.perMonth")}
                  </div>
                )}
              </button>
            );
          })}
        </motion.div>

        {/* Features + CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-5 max-w-md mx-auto rounded-2xl border border-white/10 bg-[#0D1E35]/80 backdrop-blur p-6 shadow-2xl shadow-black/40"
        >
          <div className="flex items-baseline gap-2">
            <span className="font-['Space_Grotesk'] font-bold text-4xl">
              {current?.displayPrice ?? "€39.99"}
            </span>
            <span className="font-mono text-sm text-[#4A6080]">
              {current ? PLAN_SUBTITLE[current.id as PlanId] : t("pw.perMonthShort")}
            </span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-[#00B4D8] uppercase tracking-wider">
            {t("pw.trialThenCharge").replace("{days}", String(trialDays))}
          </div>

          <ul className="mt-4 space-y-2 paywall-features">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-[13px] leading-snug text-white/85">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-[#0094C6]/20 text-[#00B4D8] flex items-center justify-center shrink-0">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {isLocked ? (
            /* Locked users (past_due/unpaid/canceled) get a single "pay now /
               reactivate" action — no repeatable free trial. */
            <>
              <button
                onClick={payNow}
                disabled={redirecting || checkout.isPending || plansQuery.isLoading || !current}
                className="mt-6 w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] rounded-xl text-xs font-mono font-semibold uppercase tracking-wider shadow-lg shadow-[#0094C6]/25 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {(redirecting || checkout.isPending) ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> {t("pw.redirecting")}
                  </>
                ) : (
                  <>
                    {subStatus === "canceled" ? t("pw.reactivateCta") : t("pw.completePayment")}
                    <ArrowRight size={14} strokeWidth={3} />
                  </>
                )}
              </button>
              <div className="mt-2 text-center text-[10px] font-mono text-[#4A6080]">
                {t("pw.chargeReactivate").replace("{price}", current?.displayPrice ?? "")}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={startTrial}
                disabled={redirecting || checkout.isPending || plansQuery.isLoading || !current}
                className="mt-6 w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] rounded-xl text-xs font-mono font-semibold uppercase tracking-wider shadow-lg shadow-[#0094C6]/25 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {(redirecting || checkout.isPending) && redirectMode === "trial" ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> {t("pw.redirecting")}
                  </>
                ) : (
                  <>
                    {t("pw.startTrialCta").replace("{days}", String(trialDays))}
                    <ArrowRight size={14} strokeWidth={3} />
                  </>
                )}
              </button>

              {/* Secondary CTA: charge immediately, skip the free trial. */}
              <button
                onClick={payNow}
                disabled={redirecting || checkout.isPending || plansQuery.isLoading || !current}
                className="mt-2.5 w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/30 text-xs font-mono font-semibold uppercase tracking-wider text-white/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {(redirecting || checkout.isPending) && redirectMode === "now" ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> {t("pw.redirecting")}
                  </>
                ) : (
                  <>{t("pw.payNowNoTrial")}</>
                )}
              </button>

              <div className="mt-2 text-center text-[10px] font-mono text-[#4A6080]">
                {t("pw.instantCharge").replace("{price}", current?.displayPrice ?? "")}
              </div>
            </>
          )}

          <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-mono text-[#4A6080] uppercase tracking-widest">
            <ShieldCheck size={12} /> {t("pw.secure")}
          </div>

          {!configured && (
            <div className="mt-4 text-center text-[11px] font-mono text-[#F4A261]">
              {t("pw.notConfigured")}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
