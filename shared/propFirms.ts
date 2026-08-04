// Prop Firm dataset — full re-verification August 2026 (official sites & help centers).
// 12 firms, current program lineups, incl. 2025-26 rule changes (FundingPips weekend
// ban, E8 SimFi 1-phase rebrand, FT+ 2.0, GFT daily-DD change 1/8/26, etc.).
// Rule text stored in EL (source of truth); the AI assistant translates for EN.
// Items that could not be verified from official sources are marked ανεπιβεβαίωτο.

export type StageRules = {
  lev?: string;
  daily?: string;
  max?: string;
  target?: string;
  mindays?: string;
  time?: string;
  consistency?: string;
  hold?: string;
  split?: string;
  payout?: string;
  news?: string;
  weekend?: string;
  trap?: string;
};

export type SizeObj = { usd: number; eur: number | null };

export type Program = {
  name: string;
  sizes: SizeObj[];
  eval: StageRules;
  funded: StageRules;
};

export type Flags = { news: string; weekend: string; consistency: string };

export type Copy = { cross: string; own: string; note: string };

export type Alloc = { overall: string; copyCap: string };

export type Summary = {
  models: string;
  sizes: string;
  lev: string;
  daily: string;
  max: string;
  target: string;
  news: string;
  weekend: string;
  split: string;
  mindays: string;
};

export type Firm = {
  name: string;
  eurOffered: boolean;
  calLink: string;
  calLabel: string;
  summary: Summary;
  flags: Flags;
  copy: Copy;
  alloc: Alloc;
  programs: Program[];
};

function S(usd: number, eur?: number): SizeObj {
  return { usd, eur: eur === undefined ? null : eur };
}

// FTMO/FundingPips EUR ladder (as shown at checkout):
//   $200K=€160K, $100K=€80K, $50K=€40K, $25K=€20K, $10K=€10K, $5K=€5K, $2.5K=€2.5K
const FE: Record<number, number> = {
  200000: 160000,
  100000: 80000,
  50000: 40000,
  25000: 20000,
  10000: 10000,
  5000: 5000,
  2500: 2500,
};
function SE(usd: number): SizeObj {
  return { usd, eur: FE[usd] || null };
}

// Prop Firm dataset — πλήρης επαλήθευση Αύγουστος 2026 (επίσημα sites/help centers).
// Όλα τα κείμενα κανόνων στα EL (source of truth)· το AI τα μεταφράζει/εξηγεί στο EN.
export const FIRMS: Firm[] = [
  {
    name: "FTMO",
    eurOffered: true,
    calLink: "https://ftmo.com/en/calendar/",
    calLabel: "FTMO Economic Calendar (restricted events ±2′)",
    summary: { models: "2-Step (Standard/Swing), 1-Step", sizes: "$10K–$200K (& EUR)", lev: "1:100 (Swing 1:30)", daily: "5% / 3%", max: "10%", target: "10%→5% / 10%", news: "~", weekend: "~", split: "80–90%", mindays: "4/phase (1-Step: καμία)" },
    flags: { news: "~ (evaluation ΕΛΕΥΘΕΡΑ· funded Standard/1-Step: όχι ±2′ σε restricted events· Swing: πάντα ελεύθερα)", weekend: "~ (funded: μόνο Swing κρατά)", consistency: "~ (μόνο 1-Step: Best Day ≤50%)" },
    copy: { cross: "✗ Copy/mirror μεταξύ διαφορετικών ατόμων ή τρίτων = απαγορεύεται (account sharing → breach).", own: "✓ Copy μεταξύ ΔΙΚΩΝ σου FTMO accounts ΟΚ — cap $400K ανά trader/στρατηγική.", note: "Αντίθετες θέσεις μεταξύ accounts = forbidden practice." },
    alloc: { overall: "Max $400K ενεργό capital· έως $2M μέσω Scaling Plan (+25% ανά 4μηνο με ≥10% profit & 2 payouts).", copyCap: "Το $400K cap ισχύει και για copy στα δικά σου accounts." },
    programs: [
      { name: "2-Step (Standard)", sizes: [SE(10000), SE(25000), SE(50000), SE(100000), SE(200000)],
        eval: { lev: "1:100", daily: "5% του ΑΡΧΙΚΟΥ — σε EQUITY (μετράει floating/swap/commission)· επαναϋπολογισμός 00:00 CE(S)T από το balance της στιγμής εκείνης", max: "10% (static, σε equity)", target: "P1: 10% · P2: 5% (με όλα κλειστά)", mindays: "4 ανά phase", time: "Unlimited", news: "✓ Ελεύθερο στο evaluation — κανένας περιορισμός", weekend: "Επιτρέπεται στο evaluation", trap: "Το daily loss «παγώνει» στο balance των 00:00 CEST: floating ζημιά που κουβαλάς μετά τα μεσάνυχτα μπορεί να σε κόψει χωρίς να κλείσεις trade." },
        funded: { lev: "1:100", daily: "5% (ίδιος μηχανισμός equity/00:00 CEST)", max: "10% (static)", target: "—", split: "80% → 90% με Scaling Plan", payout: "On-demand από τη 14η μέρα μετά το 1ο trade· δυνατότητα roll στο balance", news: "Όχι open/close (ούτε SL/TP/pending fills) ±2′ γύρω από restricted events (Fed/FOMC, NFP, US CPI, ECB/BoE/BoC/RBA/RBNZ/SNB rates κ.ά.) — μόνο στα επηρεαζόμενα instruments", weekend: "Όχι — κλείσε πριν το ΣΚ και πριν από market breaks >2h", trap: "SL/TP που γεμίζει ΜΕΣΑ στο ±2′ window = breach. Το Swing είναι πλήρως εξαιρεμένο από news/weekend — αν κρατάς θέσεις, πάρε Swing." } },
      { name: "2-Step (Swing)", sizes: [SE(10000), SE(25000), SE(50000), SE(100000), SE(200000)],
        eval: { lev: "1:30", daily: "5% (equity, 00:00 CEST)", max: "10% (static)", target: "P1: 10% · P2: 5%", mindays: "4 ανά phase", time: "Unlimited", news: "Ελεύθερο (Swing)", weekend: "Επιτρέπεται (Swing)", trap: "Leverage 1:30 (όχι 1:100) — υπολόγισε lots αλλιώς." },
        funded: { lev: "1:30", daily: "5%", max: "10% (static)", target: "—", split: "80% → 90% (Scaling)", payout: "On-demand από τη 14η μέρα", news: "✓ Ελεύθερο — το Swing εξαιρείται πλήρως", weekend: "✓ Επιτρέπεται", trap: "Weekend gap πάνω σε static 10% — μέτρα το exposure της Παρασκευής." } },
      { name: "1-Step", sizes: [SE(10000), SE(25000), SE(50000), SE(100000), SE(200000)],
        eval: { lev: "1:100", daily: "3% (equity, 00:00 CEST)", max: "10% EOD-TRAILING: ψηλότερο balance στις 00:00 CEST − 10% του αρχικού· μόνο ανεβαίνει", target: "10%", mindays: "Καμία", time: "Unlimited", news: "✓ Ελεύθερο στο evaluation", weekend: "Επιτρέπεται στο evaluation", trap: "Best Day Rule: η καλύτερη μέρα ≤50% του αθροίσματος των κερδοφόρων ημερών — δεν είναι breach αλλά ΔΕΝ περνάς μέχρι να «αραιώσεις». Trailing max: αν δώσεις πίσω ένα καλό σερί, κόβεσαι νωρίς." },
        funded: { lev: "1:100", daily: "3%", max: "10% EOD-trailing (reset σε νέο account μετά από κάθε payout)", target: "—", split: "90% από την 1η μέρα (χωρίς roll στο balance)", payout: "On-demand από τη 14η μέρα μετά το 1ο trade", news: "Όχι ±2′ restricted events (όπως Standard) — δεν υπάρχει Swing επιλογή στο 1-Step", weekend: "Όχι — κλείσε πριν το ΣΚ", trap: "Best Day ≤50% ισχύει ΚΑΙ στο funded (μπλοκάρει payout). 3% daily + trailing = μικρό περιθώριο για giveback." } },
    ],
  },
  {
    name: "FundingPips",
    eurOffered: true,
    calLink: "https://app.fundingpips.com/economic-calendar",
    calLabel: "FundingPips Calendar (red-folder ±5′ στο Master)",
    summary: { models: "2-Step Std/Flex/Pro, 1-Step Flex, Zero", sizes: "$5K–$200K (& EUR)", lev: "1:100 FX (dynamic σε metals/indices στο Master)", daily: "3–5%", max: "6–12%", target: "8→5 / 10→6 / 6→6 / 12%", news: "~", weekend: "✗ funded (από 29/1/26)", split: "60–100%", mindays: "0–3/phase" },
    flags: { news: "~ (evaluation ελεύθερα «όχι επίτηδες»· MASTER: όχι ±5′ red-folder — soft breach, αφαιρείται ΟΛΟ το κέρδος του trade· εξαίρεση θέσεις ανοιχτές ≥5h· Zero: ±10′ HARD breach)", weekend: "✗ Master ΔΕΝ κρατά ΣΚ από 29/1/2026 (auto-close Παρασκευή, όχι breach· τα gaps μετράνε)· evaluation ΟΚ· Zero: hard breach", consistency: "~ (Std: 35% μόνο On-Demand· Zero: 15%· Profit Concentration 60% από 27/6/26)" },
    copy: { cross: "✗ Inbound copy/signals/διαχείριση από τρίτους = τερματισμός. VPN/VPS απαγορεύονται.", own: "✓ Copy μεταξύ ΔΙΚΩΝ σου accounts ΟΚ. EA μόνο δικό σου (με απόδειξη source code).", note: "Striking System στο Master: floating loss 1.2% ανά «trade idea» (1% στο 1-Step Flex) = strike· 4 strikes = κλείσιμο· τα strikes ΔΕΝ μηδενίζουν." },
    alloc: { overall: "Max $300K ανά trader. Resets: P1 −15% / P2 −10% / Master −7%.", copyCap: "Copy στα δικά σου εντός του $300K." },
    programs: [
      { name: "2-Step Standard", sizes: [SE(5000), SE(10000), SE(25000), SE(50000), SE(100000), SE(200000)],
        eval: { lev: "1:100 FX", daily: "5% από το ΜΕΓΑΛΥΤΕΡΟ του balance/equity της ημέρας (reset 00:00 UTC+3)· στιγμιαίο άγγιγμα = breach", max: "10% (static)", target: "P1: 8% · P2: 5% (το 10% variant αποσύρθηκε 24/7/26)", mindays: "3 ανά phase", time: "Unlimited", news: "Ελεύθερο (όχι «επίτηδες news trading»)", weekend: "Επιτρέπεται στο evaluation", trap: "30 μέρες χωρίς ΚΛΕΙΣΜΕΝΟ trade = breach (τα ανοιχτά ΔΕΝ μετράνε). Profit Concentration: trade idea >60% του target → μόνιμη απαίτηση 4 κερδοφόρων ημερών (≥0.5%) πριν από ΚΑΘΕ payout." },
        funded: { lev: "1:100 FX· dynamic σε metals/indices/energies (από 16/3/26)· crypto 1:1", daily: "5%", max: "10% (static)", target: "—", split: "Επιλογή στην αγορά: On-Demand 90% / Weekly 60% / Bi-Weekly 80% / Monthly 100%", payout: "Min αίτημα 1%· On-Demand θέλει 35% consistency + 2% profit", news: "Όχι ±5′ red-folder (ομιλίες: έως 5′ μετά τη λήξη)· soft breach = αφαίρεση ΟΛΟΥ του κέρδους· εξαίρεση αν άνοιξες ≥5h πριν", weekend: "✗ ΟΧΙ — auto-close Παρασκευή", trap: "Striking System (>$25K): floating 1.2%/idea = strike ακόμα κι αν κλείσει κερδοφόρο (1ο: warning+αφαίρεση· 2ο: μισό split· 3ο: 20%· 4ο: κλείσιμο)." } },
      { name: "2-Step Flex", sizes: [SE(5000), SE(10000), SE(25000), SE(50000), SE(100000), SE(200000)],
        eval: { lev: "1:100 FX", daily: "4% (higher of balance/equity, 00:00 UTC+3)", max: "12% (static)", target: "P1: 10% · P2: 6%", mindays: "85% variant: καμία· 95% variant: 3 κερδοφόρες (≥0.5%) ανά phase", time: "Unlimited", news: "Ελεύθερο", weekend: "Επιτρέπεται στο evaluation", trap: "Risk Per Trade Idea στο Master: 3% ($25K) / 2% (πάνω)· re-entry εντός 10′ από κλείσιμο χαμένου = ΙΔΙΟ idea (αθροίζονται οι ζημιές)." },
        funded: { lev: "1:100 FX (dynamic metals/indices)", daily: "4%", max: "12% (static)", target: "—", split: "85% bi-weekly ή 95% bi-weekly + 3 κερδοφόρες/κύκλο (επιλογή στην αγορά)", payout: "Κάθε 14 ημέρες", news: "Όχι ±5′ red-folder (soft breach, αφαίρεση κέρδους)", weekend: "✗ ΟΧΙ", trap: "Το 10λεπτο re-entry grouping μετατρέπει 2-3 «μικρές» απόπειρες σε ένα μεγάλο idea πάνω από το όριο." } },
      { name: "2-Step Pro", sizes: [SE(5000), SE(10000), SE(25000), SE(50000), SE(100000), SE(200000)],
        eval: { lev: "1:100 FX", daily: "3% (higher of balance/equity)", max: "6% (static)", target: "P1: 6% · P2: 6%", mindays: "1 ανά phase", time: "Unlimited", news: "Ελεύθερο", weekend: "Επιτρέπεται στο evaluation", trap: "6% συνολικό με 3% daily = δύο κακές μέρες τέλος — και στα ΔΥΟ phases." },
        funded: { lev: "1:100 FX (dynamic metals/indices)", daily: "3%", max: "6% (static)", target: "—", split: "80% weekly (7 ημέρες)", payout: "Κάθε 7 ημέρες", news: "Όχι ±5′ red-folder", weekend: "✗ ΟΧΙ", trap: "Χωρίς Risk-Per-Idea εδώ, αλλά το 6% max δεν συγχωρεί ούτε ένα κακό ΣΚ gap." } },
      { name: "1-Step Flex", sizes: [SE(5000), SE(10000), SE(25000), SE(50000), SE(100000)],
        eval: { lev: "1:100 FX", daily: "3% (higher of balance/equity)", max: "12% (static)", target: "12% (νέο μοντέλο — τα παλιά 10%/6% ΔΕΝ ισχύουν)", mindays: "Καμία", time: "Unlimited", news: "Ελεύθερο", weekend: "Επιτρέπεται στο evaluation", trap: "Striking System από ΟΛΑ τα μεγέθη εδώ: floating 1%/trade idea = strike. Και 30ήμερο inactivity breach." },
        funded: { lev: "1:100 FX (dynamic metals/indices)", daily: "3%", max: "12% (static)", target: "—", split: "85% bi-weekly (σταθερό)", payout: "Κάθε 14 ημέρες", news: "Όχι ±5′ red-folder", weekend: "✗ ΟΧΙ", trap: "Profit Concentration 60% ισχύει σε ΟΛΑ τα μεγέθη στο 1-Step Flex." } },
      { name: "Zero (Instant)", sizes: [SE(5000), SE(10000), SE(25000), SE(50000), SE(100000)],
        eval: { lev: "1:50 FX, crypto 1:1· commission $7/lot", daily: "3% (hard)", max: "5% TRAILING από peak equity· κλειδώνει στο αρχικό στα +5%· ΔΕΝ κάνει reset μετά από payout", target: "Χωρίς target — instant", mindays: "7 κερδοφόρες (≥0.25%) ανά κυλιόμενο 30ήμερο = ΥΠΟΧΡΕΩΤΙΚΟ", time: "—", news: "✗ HARD breach: όχι open/close/ΚΡΑΤΗΜΑ ±10′ γύρω από red-folder", weekend: "✗ HARD breach", trap: "Max Open Risk: συνδυασμένο floating loss 1% = hard breach (τα κερδοφόρα ΔΕΝ το αντισταθμίζουν)· Risk/idea 3%/2%." },
        funded: { lev: "1:50 FX", daily: "3%", max: "5% trailing (χωρίς reset)", target: "—", split: "95% bi-weekly", payout: "Όροι: consistency ≤15%, 7 κερδοφόρες μέρες, το πρώτο 3% προφίτ μένει ως μαξιλάρι, ο μεγαλύτερος χαμένος ≤ μεγαλύτερου κερδισμένου", news: "✗ ±10′ hard breach", weekend: "✗ hard breach", trap: "Το πιο αυστηρό πρόγραμμα της FundingPips — σχεδόν κάθε κανόνας εδώ είναι hard breach." } },
    ],
  },
  {
    name: "FundedNext",
    eurOffered: false,
    calLink: "https://fundednext.com/general-rules/cfds",
    calLabel: "FundedNext Rules Hub (News Profit Split ±5′)",
    summary: { models: "Stellar 2-Step/1-Step/Lite, Instant", sizes: "$2K–$200K", lev: "1:100 (1-Step 1:30, Instant 1:30)", daily: "3–5%", max: "6–10%", target: "8→5 / 10 / 8→4", news: "~", weekend: "✓", split: "80–95%", mindays: "2–5/phase" },
    flags: { news: "~ (παντού επιτρέπεται ΧΩΡΙΣ μπλόκο· ΑΛΛΑ σε funded+Instant: κέρδη από trades που άνοιξαν/έκλεισαν ±5′ γύρω από high-impact μετράνε στο 40% — News Profit Split· ζημιές 100%· μετράνε και SL/TP fills)", weekend: "✓ Παντού επιτρέπεται (και overnight)", consistency: "~ (μόνο με On-Demand add-on: best day ≤40% — καθυστερεί payout, όχι breach)" },
    copy: { cross: "✗ Τρίτοι copiers (Social Trader Tools, Duplikum κ.λπ.) = απαγορεύονται. Cross-account hedging = breach.", own: "✓ Copy μόνο μεταξύ ΔΙΚΩΝ σου CHALLENGE accounts — ΠΟΤΕ με funded στο κύκλωμα.", note: "EA/VPS σε MT4/5 θέλουν paid add-on. Forbidden: HFT, tick scalping, grid, «gambling» (≥70% margin/all-in)." },
    alloc: { overall: "Max $300K ($600K με Double Up). Payouts σε ≤24h (μέσος ~5h)· εγγύηση $1.000 αν αργήσουν.", copyCap: "Copy εντός του allocation cap." },
    programs: [
      { name: "Stellar 2-Step", sizes: [S(6000), S(15000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "FX 1:100 · Indices/Comm 1:25 · Crypto 1:1", daily: "5% του ΑΡΧΙΚΟΥ balance (equity-based, reset 00:00 server GMT+2/3) — τα χθεσινά κέρδη ΔΕΝ δίνουν buffer", max: "10% (static)", target: "P1: 8% · P2: 5%", mindays: "5 ανά phase", time: "Unlimited", news: "Ελεύθερο στο challenge (χωρίς News Profit Split)", weekend: "Επιτρέπεται", trap: "60 μέρες inactivity = απενεργοποίηση. Το daily είναι πάντα 5% του ΑΡΧΙΚΟΥ: funded στο +6% εξακολουθεί να κόβεται στη −5% μέρα." },
        funded: { lev: "FX 1:100 · Indices/Comm 1:15", daily: "5% του αρχικού", max: "10% (static)", target: "—", split: "80% → 90% μετά το scale-up (έως 95% με add-ons)· +15% bonus του challenge profit (πληρώνεται στο 1ο scale-up, αλλαγή 12/1/26)", payout: "1ο σε 21 μέρες, μετά κάθε 14 (Bi-Weekly add-on: χωρίς 21ήμερο· On-Demand: οποτεδήποτε με ≥2%)", news: "News Profit Split: κέρδη ±5′ γύρω από high-impact → 40%", weekend: "Επιτρέπεται", trap: "Floating ζημιά που περνάει τα μεσάνυχτα server μετράει στη νέα μέρα — κλείσε ή hedge πριν το rollover αν είσαι κοντά στο όριο." } },
      { name: "Stellar 1-Step", sizes: [S(6000), S(15000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "FX 1:30 · Indices 1:10 · Comm 1:15 (ΟΧΙ 1:100 πια)", daily: "3% του αρχικού", max: "6% (static)", target: "10%", mindays: "2", time: "Unlimited", news: "Ελεύθερο στο challenge", weekend: "Επιτρέπεται", trap: "3% daily σε 6% συνολικό = δύο κακές μέρες. Μην ανοίγεις 2-Step μεγέθη θέσεων με 1:30." },
        funded: { lev: "FX 1:30", daily: "3%", max: "6% (static)", target: "—", split: "80% → 90/95%· +15% challenge bonus", payout: "Κάθε 5 εργάσιμες από τον 1ο κύκλο· fee refund με το 3ο payout", news: "News Profit Split 40% (±5′)", weekend: "Επιτρέπεται", trap: "Το 6% max είναι πολύ σφιχτό — ένα ΣΚ gap και μια κακή μέρα φτάνουν." } },
      { name: "Stellar Lite", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "FX 1:100 · Indices/Comm 1:25", daily: "4% του αρχικού", max: "8% (static· 10% με add-on)", target: "P1: 8% · P2: 4%", mindays: "5 ανά phase", time: "Unlimited", news: "Ελεύθερο στο challenge", weekend: "Επιτρέπεται", trap: "Φθηνότερο αλλά 8%/4% όρια — μην τα μπερδεύεις με τα 10%/5% του κανονικού 2-Step." },
        funded: { lev: "FX 1:100", daily: "4%", max: "8% (static)", target: "—", split: "80% → 90% (ΧΩΡΙΣ το 15% challenge bonus)", payout: "1ο σε 21 μέρες, μετά κάθε 14", news: "News Profit Split 40% (±5′)", weekend: "Επιτρέπεται", trap: "Υψηλότερα commissions ($7/side FX) τρώνε τα scalps." } },
      { name: "Stellar Instant", sizes: [S(2000), S(5000), S(10000), S(25000), S(50000), S(100000)],
        eval: { lev: "FX 1:30 · Indices 1:5 · Comm 1:7.5", daily: "ΧΩΡΙΣ daily limit", max: "6% TRAILING από τα equity highs· κλειδώνει στο αρχικό balance", target: "Χωρίς target — funded από μέρα 1", mindays: "—", time: "—", news: "News Profit Split 40% (±5′) από την αρχή", weekend: "Επιτρέπεται", trap: "Το trailing 6% ανεβαίνει με ΚΑΘΕ νέο equity high — κλείδωσε νωρίς το buffer." },
        funded: { lev: "FX 1:30", daily: "—", max: "6% trailing", target: "—", split: "80% → 90%", payout: "Κύκλοι 14 ημερών", news: "News Profit Split 40%", weekend: "Επιτρέπεται", trap: "60ήμερο inactivity και εδώ. Trailing χωρίς daily = μεγάλες μέρες ανεβάζουν το πάτωμα γρήγορα." } },
    ],
  },
  {
    name: "The5ers",
    eurOffered: false,
    calLink: "https://help.the5ers.com/",
    calLabel: "The5ers Help (news ±2′ σε High Stakes — και στο evaluation)",
    summary: { models: "High Stakes, Hyper Growth, Pro Growth, Bootcamp, Instant", sizes: "$2.5K–$100K (scaling έως $4M)", lev: "1:100 (HS) / 1:30", daily: "3–5%", max: "4–10%", target: "8-10→5 / 10 / 6×3", news: "~", weekend: "✓", split: "50–100%", mindays: "0–3 profit days" },
    flags: { news: "~ (High Stakes: ±2′ execution ban σε ΟΛΑ τα order types — ΚΑΙ στο evaluation ΚΑΙ στο funded· soft breach: κέρδη αφαιρούνται, ζημιές μένουν. Hyper Growth/Bootcamp: ελεύθερο εκτός bracketing/straddling)", weekend: "✓ Επιτρέπεται παντού, όλα τα στάδια", consistency: "Όχι αριθμητικός κανόνας στα CFD (το 40% είναι μόνο Futures)" },
    copy: { cross: "✗ Εξωτερικά signals/account sharing/pass-services = τερματισμός χωρίς refund.", own: "✓ Copy μεταξύ δικών σου accounts ΟΚ (όχι στο Bootcamp).", note: "Από 28/7/26: απαγορεύονται cross-firm hedging, «κατασκευασμένες» κερδοφόρες μέρες, gambling-style overleverage." },
    alloc: { overall: "Scaling έως $4M (HS: $500K cap ανά account ladder). Bi-weekly payouts, min $150, 1ο στις 14 μέρες.", copyCap: "Όρια ταυτόχρονων accounts ανά tier." },
    programs: [
      { name: "High Stakes (2-Step)", sizes: [S(2500), S(5000), S(10000), S(25000), S(50000), S(100000)],
        eval: { lev: "1:100", daily: "5% — ΑΜΕΣΟΣ ΤΕΡΜΑΤΙΣΜΟΣ· βάση: το ΜΕΓΑΛΥΤΕΡΟ του closing balance/equity της προηγ. μέρας (snapshot 00:00 UTC+3)· μετριέται σε live equity", max: "10% static πάτωμα από το αρχικό balance (ΔΕΝ κάνει trail· κέρδη προσθέτουν buffer)", target: "New tier: P1 10% · P2 5% (Classic tier: 8%/5%)", mindays: "3 κερδοφόρες (≥0.5% κλειστά) ανά step", time: "Unlimited", news: "✗ ±2′ execution ban ΚΑΙ στο evaluation (soft breach: αφαίρεση κερδών)", weekend: "Επιτρέπεται", trap: "Το 5% daily είναι τερματισμός με τη μία, μετρημένο σε live equity — τα overnight swings σκοτώνουν εδώ. Και το ±2′ ισχύει από το challenge ήδη." },
        funded: { lev: "1:100", daily: "5% (τερματισμός)", max: "10% static (τα payouts ΜΙΚΡΑΙΝΟΥΝ το buffer)", target: "10% ανά scaling step", mindays: "3 κερδοφόρες ανά scale-up", split: "80% → 85% ($175–200K) → 90% ($250–300K) → 100% + bonuses ($350K+)", payout: "Bi-weekly, min $150· 1ο στις 14 μέρες", news: "✗ ±2′ execution ban (soft breach)", weekend: "Επιτρέπεται", trap: "Κάθε ανάληψη κατεβάζει το μαξιλάρι σου πάνω από το static πάτωμα — μην αδειάζεις το account." } },
      { name: "Hyper Growth (1-Step)", sizes: [S(5000), S(10000), S(20000)],
        eval: { lev: "1:30", daily: "3% = ΠΑΓΩΜΑ ημέρας (κλείνουν τα trades, συνεχίζεις αύριο) — ΟΧΙ τερματισμός", max: "6% static stop-out", target: "10% (περνάει άμεσα μόλις το πιάσεις)", mindays: "Καμία", time: "Unlimited", news: "Ελεύθερο (όχι bracketing/straddling)", weekend: "Επιτρέπεται", trap: "Max $40K συνολικό evaluation capital. Το 6% stop-out είναι μόλις 2 «παγωμένες» μέρες." },
        funded: { lev: "1:30", daily: "3% (pause)", max: "6% static", target: "10% ανά επίπεδο → το account ΔΙΠΛΑΣΙΑΖΕΤΑΙ (έως $4M)", split: "50% → 75% → έως 100% με scaling", payout: "Bi-weekly", news: "Ελεύθερο", weekend: "Επιτρέπεται", trap: "One-trade oversized περάσματα κινδυνεύουν να ακυρωθούν με τους νέους anti-concentration όρους (Ιούλ 26)." } },
      { name: "Pro Growth (1-Step)", sizes: [S(5000), S(10000), S(20000)],
        eval: { lev: "1:30", daily: "3% = ΤΕΡΜΑΤΙΣΜΟΣ (όχι pause — βασική διαφορά από Hyper Growth)", max: "6% static", target: "10%", mindays: "3 κερδοφόρες", time: "Unlimited", news: "Πιθανόν όπως Hyper Growth (μη πλήρως επιβεβαιωμένο)", weekend: "Επιτρέπεται", trap: "Μην το μπερδέψεις με το Hyper Growth: εδώ το 3% daily ΚΟΒΕΙ, δεν παγώνει." },
        funded: { lev: "1:30", daily: "3% (τερματισμός)", max: "6% static", target: "—", split: "75% → 80% στα $350K → έως 100% (cap $500K)", payout: "Bi-weekly", news: "Ως άνω", weekend: "Επιτρέπεται", trap: "Το +25% split έναντι HG πληρώνεται με αυστηρότερο daily κανόνα." } },
      { name: "Bootcamp (3-Step)", sizes: [S(5000), S(10000), S(20000)],
        eval: { lev: "1:30", daily: "Κανένα daily στο evaluation", max: "5% ανά step", target: "6% × 3 steps", mindays: "Καμία (κάθε level ξεκινά εντός 48h από το πέρασμα)", time: "48h για έναρξη επόμενου level", news: "Ελεύθερο (όχι bracketing)", weekend: "Επιτρέπεται", trap: "ΥΠΟΧΡΕΩΤΙΚΟ stop-loss σε ΚΑΘΕ θέση, ρίσκο SL ≤2% του balance· 5 παραβάσεις = τερματισμός." },
        funded: { lev: "1:30", daily: "3% (pause)", max: "4%", target: "5% ανά scaling step", split: "50% → 75% → 80% ($2M) → 100% ($2.5M+)· cap $4M", payout: "Bi-weekly", news: "Ελεύθερο", weekend: "Επιτρέπεται", trap: "Το φθηνότερο ταξίδι προς μεγάλο κεφάλαιο, αλλά ο mandatory-SL/2% κανόνας θέλει πειθαρχία σε ΚΑΘΕ κλικ." } },
      { name: "Instant Funding", sizes: [S(5000), S(10000), S(20000)],
        eval: { lev: "1:30 (κατά δήλωση firm — επιβεβαίωσε στο dashboard)", daily: "Χωρίς επίσημο daily στο πρόγραμμα (πηγές τρίτων λένε 3% — ανεπιβεβαίωτο)", max: "6% static", target: "Χωρίς target", mindays: "—", time: "—", news: "Ελεύθερο (όχι bracketing)", weekend: "Επιτρέπεται", trap: "6% πάτωμα από μέρα 1 και ΚΑΘΕ payout μικραίνει το μαξιλάρι." },
        funded: { lev: "1:30", daily: "—", max: "6% static", target: "—", split: "50% αρχικά → scaling προς 100%", payout: "Bi-weekly, min $150· έως 4 accounts", news: "Ελεύθερο", weekend: "Επιτρέπεται", trap: "Χαμηλό αρχικό split (50%) — δες το ως γέφυρα προς scaling, όχι ως τελικό εισόδημα." } },
    ],
  },
  {
    name: "Alpha Capital",
    eurOffered: false,
    calLink: "https://help.alphacapitalgroup.uk/",
    calLabel: "Alpha Help Centre (news ±5′ σε funded· 2-minute rule)",
    summary: { models: "Alpha One (1-Step), Pro (2-Step), Three (3-Step), Swing, Direct", sizes: "$5K–$200K (cap $400K)", lev: "1:100 (Pro) / 1:30–1:50", daily: "3–5%", max: "4–10%", target: "6–12% variants", news: "~", weekend: "~", split: "80% (90% add-on)", mindays: "1–3/phase" },
    flags: { news: "~ (evaluation ελεύθερα ΟΛΑ τα πλάνα· funded: ±5′ ban σε opens/closes/SL-TP/stop fills — soft breach, κέρδη άκυρα· USD CPI/Fed/NFP κόβουν ΟΛΑ τα instruments· Swing funded: trades μέσα στο ±2′ πρέπει να κρατήσουν >2′)", weekend: "~ (One/Three/Swing: ΟΚ· Pro & Direct funded: ΟΧΙ — soft breach)", consistency: "~ (μόνο On-Demand payout: best day ≤40%· Direct: ≤15%)" },
    copy: { cross: "✗ Group trading = μαζικά bans (~150 traders). Copy από/προς τρίτους απαγορεύεται.", own: "✓ Copy στα δικά σου accounts ΜΟΝΟ αν δηλώσεις Master+Slave με email ΠΡΙΝ ξεκινήσεις.", note: "2-minute rule: μέση διάρκεια trade >2′ ΚΑΙ ≥50% των κερδών από trades >2′ (eval: restart P1· funded: αφαίρεση κερδών)." },
    alloc: { overall: "Max $400K συνολικά. Max Risk Rule (αγορές μετά 21/7/26): floating loss ανά asset 3% ($5–25K) / 2% ($50–200K) / 1% Direct, με 10′ same-direction cool-down που αθροίζει ζημιές — παράβαση = κλείσιμο.", copyCap: "Max exposure 2.5 lots/$5K (Swing: μισό)· 2η παράβαση = απενεργοποίηση." },
    programs: [
      { name: "Alpha One (1-Step)", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:30", daily: "6%: 3% · 10%: 4% · 12%: 5% (higher of balance/equity, reset 00:00 GMT+3, breach σε live equity)", max: "TRAILING (HWM, κλειδώνει στο αρχικό): 6%→4% / 10%→6% / 12%→8%", target: "Variants: 6% ή 10% ή 12% (μία φάση)", mindays: "1", time: "Unlimited", news: "Ελεύθερο στο evaluation", weekend: "Επιτρέπεται", trap: "30ήμερο inactivity = ΜΗ αναστρέψιμη απενεργοποίηση. Πρόσεξε ποιο variant αγόρασες — τα όρια διαφέρουν." },
        funded: { lev: "1:30", daily: "4–5% κατά variant", max: "4–8% trailing", target: "—", split: "80% (90% με add-on)", payout: "On-Demand (40% consistency + 2% profit)", news: "±5′ ban (soft breach)", weekend: "Επιτρέπεται", trap: "Το trailing πάτωμα + Max Risk Rule (2-3% floating/asset) θέλουν μικρές θέσεις." } },
      { name: "Alpha Pro (2-Step)", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:100", daily: "6%: 3% · 8%: 4% · 10%: 5% (8%/10% variants: balance-based όριο, breach σε live equity)", max: "STATIC: 6% / 8% / 10% κατά variant", target: "6%/6% ή 8%/5% ή 10%/5%", mindays: "3 ανά phase", time: "Unlimited", news: "Ελεύθερο στο evaluation", weekend: "✓ Επιτρέπεται στο evaluation", trap: "ΤΟ κλασικό λάθος στην Alpha: στο evaluation κρατάς ΣΚ, στο funded Pro ΑΠΑΓΟΡΕΥΕΤΑΙ — όσοι περνούν με swing στυλ σκάνε στο funded." },
        funded: { lev: "1:100", daily: "3–5% κατά variant", max: "6–10% static", target: "—", split: "80% (90% add-on)", payout: "Bi-Weekly (κάθε 14, min $100, 1ο μετά από 5 same-day-open-close μέρες) ή On-Demand (40% consistency)", news: "±5′ ban· USD majors κόβουν τα πάντα", weekend: "✗ ΟΧΙ (soft breach)", trap: "Scaling +10% ανά +10% κέρδος έως $2M — μόνο Pro/Swing/Three." } },
      { name: "Alpha Three (3-Step)", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:50", daily: "4%", max: "6% static", target: "8% / 4% / 4%", mindays: "3 ανά phase", time: "Unlimited", news: "Ελεύθερο στο evaluation", weekend: "Επιτρέπεται", trap: "Τρία στάδια με 6% συνολικό — ο δρόμος είναι μακρύς, το buffer μικρό." },
        funded: { lev: "1:50", daily: "4%", max: "6% static", target: "—", split: "80% (90% add-on)", payout: "Bi-Weekly ή On-Demand", news: "±5′ ban", weekend: "Επιτρέπεται", trap: "2-minute rule + Max Risk Rule ισχύουν κανονικά." } },
      { name: "Alpha Swing (2-Step)", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:30", daily: "5% (balance-based)", max: "10% static", target: "P1: 10% · P2: 5%", mindays: "3 ανά phase", time: "Unlimited", news: "Ελεύθερο", weekend: "✓ Επιτρέπεται (και στο funded)", trap: "Max exposure στο ΜΙΣΟ του κανονικού (1.25 lots/$5K)." },
        funded: { lev: "1:30", daily: "5%", max: "10% static", target: "—", split: "80% (90% add-on)", payout: "On-Demand (40% consistency)", news: "Χαλαρότερο: trades που ανοίγουν ±2′ γύρω από news πρέπει απλώς να κρατηθούν >2′", weekend: "✓ Επιτρέπεται", trap: "Το μόνο Alpha πλάνο για weekend holders — αλλά με μισό exposure cap." } },
      { name: "Alpha Direct (Instant)", sizes: [S(5000), S(10000), S(25000), S(50000)],
        eval: { lev: "1:30", daily: "3%", max: "5% TRAILING", target: "Χωρίς target — funded από μέρα 1", mindays: "—", time: "—", news: "±5′ ban από την αρχή", weekend: "✗ ΟΧΙ", trap: "Χωρίς EAs. Max Risk 1% floating/asset — το αυστηρότερο της Alpha." },
        funded: { lev: "1:30", daily: "3%", max: "5% trailing", target: "—", split: "90% built-in", payout: "Χρειάζεται 3% profit μαξιλάρι πρώτα, μετά min 1%· consistency 15%", news: "±5′ ban", weekend: "✗ ΟΧΙ", trap: "15% best-day consistency = θέλει ~7+ ισοκατανεμημένες κερδοφόρες μέρες πριν δεις χρήμα." } },
    ],
  },
  {
    name: "Hola Prime",
    eurOffered: false,
    calLink: "https://holaprime.com/forex/forex-trading-rules/",
    calLabel: "Hola Prime Rules (2% risk/idea + SL εντός 3′ σε funded)",
    summary: { models: "1-Step Prime, 2-Step Prime, 2-Step Pro, Direct", sizes: "$10K–$200K (cap $500K)", lev: "1:50 (Prime) / 1:100 (Pro)", daily: "3–5%", max: "6–10%", target: "10 / 8→5", news: "~", weekend: "~", split: "80–95%", mindays: "2–3/phase" },
    flags: { news: "~ (Prime lines: ελεύθερο παντού· Pro funded: ±5′ ban σε επηρεαζόμενα instruments — soft breach, κέρδη αναστρέφονται)", weekend: "~ (Prime: ΟΚ παντού· Pro funded: ΟΧΙ — auto-close Παρασκευή 15:45 EST)", consistency: "~ (μόνο On-Demand payout: best day ≤40% + ≥2% profit)" },
    copy: { cross: "✗ Account sharing απαγορεύεται· copy από τρίτους: θεωρείται prohibited (η επίσημη λίστα είναι ασαφής — υπόθεσε ΟΧΙ).", own: "✓ Πιθανόν OK μεταξύ δικών σου (ανεπιβεβαίωτο επίσημα).", note: "FUNDED: SL ΥΠΟΧΡΕΩΤΙΚΟ εντός 3′ από το άνοιγμα (χωρίς SL = breach). 2% max risk ανά trade idea (layers + re-entries εντός 10′ = ένα idea)· κακή συμπεριφορά → κόβεται στο 1%." },
    alloc: { overall: "Max $500K (μαζί με futures: $800K). Payout σε 1 ώρα (εγγύηση)· fee refund 100% σε 4 δόσεις.", copyCap: "Deloitte-reviewed payouts: 98.35% εντός 1h." },
    programs: [
      { name: "1-Step Prime", sizes: [S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "FX 1:50 · Metals 1:10 · Indices 1:5 · Crypto 1:1", daily: "3% του closing balance προηγ. μέρας (Day 1: αρχικό)· intraday κέρδος ΠΡΟΣΘΕΤΕΙ στο όριο· reset 17:00 EST", max: "6% static", target: "10%", mindays: "2", time: "Unlimited", news: "Ελεύθερο", weekend: "Επιτρέπεται", trap: "30ήμερο inactivity (μόνο ΑΝΟΙΓΜΑ trade μετράει — τα κλεισίματα/SL edits όχι)." },
        funded: { lev: "FX 1:50", daily: "3%", max: "6% static", target: "—", split: "Bi-weekly 80% (3 κερδοφόρες ≥0.5%/14ήμερο) · Monthly 95% (7/30ήμερο) · On-Demand 80% (40% consistency)", payout: "1-hour payout guarantee", news: "Ελεύθερο", weekend: "Επιτρέπεται", trap: "FUNDED: 2% risk/idea + SL εντός 3′ — layering αθροίζεται, breach στο 2.1% χωρίς να το καταλάβεις." } },
      { name: "2-Step Prime", sizes: [S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "FX 1:50", daily: "5% (4% στο $200K)· closing balance προηγ. μέρας· reset 17:00 EST", max: "10% static (8% στο $200K)", target: "P1: 8% · P2: 5%", mindays: "3 ανά phase", time: "Unlimited", news: "Ελεύθερο", weekend: "Επιτρέπεται", trap: "Στο $200K τα όρια στενεύουν σε 4%/8% — δεν είναι ίδια με τα μικρά." },
        funded: { lev: "FX 1:50", daily: "5% (4% $200K)", max: "10% static (8% $200K)", target: "—", split: "80–95% κατά κύκλο (βλ. 1-Step)", payout: "1h guarantee", news: "Ελεύθερο (Prime line)", weekend: "Επιτρέπεται", trap: "2% risk/idea + 3′ SL rule στο funded." } },
      { name: "2-Step Pro", sizes: [S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "FX 1:100 · Metals 1:20 · Indices 1:10 · Crypto 1:2", daily: "5% (4% $200K)", max: "10% static (8% $200K)", target: "P1: 8% · P2: 5%", mindays: "2 ανά phase", time: "Unlimited", news: "Ελεύθερο στο evaluation", weekend: "Επιτρέπεται στο evaluation", trap: "Το 1:100 σε τραβάει σε μεγαλύτερα lots — θυμήσου ότι στο funded έρχονται news/weekend περιορισμοί." },
        funded: { lev: "FX 1:100", daily: "5% (4% $200K)", max: "10% static (8% $200K)", target: "—", split: "80–95% κατά κύκλο", payout: "1h guarantee", news: "✗ ±5′ ban (soft breach, κέρδη αναστρέφονται)", weekend: "✗ ΟΧΙ — auto-close Παρασκευή 15:45 EST", trap: "Lot-exposure caps: 2η παράβαση = split 30% + τερματισμός." } },
      { name: "Direct (Instant)", sizes: [S(5000), S(10000), S(25000), S(50000)],
        eval: { lev: "FX 1:50", daily: "~3% (ανεπιβεβαίωτο — τσέκαρε στο dashboard)", max: "~6% static (ανεπιβεβαίωτο)", target: "Χωρίς target", mindays: "—", time: "—", news: "Κατά το Prime line: ελεύθερο", weekend: "Επιτρέπεται", trap: "2% risk/idea ισχύει από μέρα 1." },
        funded: { lev: "FX 1:50", daily: "~3%", max: "~6%", target: "—", split: "Έως 90%", payout: "1h guarantee", news: "Ελεύθερο", weekend: "Επιτρέπεται", trap: "Οι λεπτομέρειες Direct δεν δημοσιεύονται πλήρως — επιβεβαίωσε πριν ρισκάρεις." } },
    ],
  },
  {
    name: "E8 Markets",
    eurOffered: false,
    calLink: "https://help.e8markets.com/",
    calLabel: "E8 Help (SimFi· ±5′ news σε Performance)",
    summary: { models: "E8 One, E8 Pro (όλα 1-phase πλέον)", sizes: "$25K–$200K (cap $500K)", lev: "FX 1:30", daily: "2.5–3% (custom)", max: "4–14% (custom)", target: "6–21% (custom)", news: "~", weekend: "✓", split: "80/90/100% (επιλογή)", mindays: "Καμία" },
    flags: { news: "~ (challenge ελεύθερα· Performance: ±5′ ban — ΔΕΝ μπλοκάρεται από την πλατφόρμα, τα κέρδη αφαιρούνται στο payout request· E8 Pro: ΤΕΛΕΙΩΣ ελεύθερο παντού)", weekend: "✓ Επιτρέπεται παντού (πλην legacy Signature)", consistency: "~ (One Performance: Best Day ≤40% — payout gate· Pro: όχι, αλλά 2% daily profit cap)" },
    copy: { cross: "✗ Copy άλλων/ομαδικό trading/signals = ban. Ένα profile ανά άτομο.", own: "✓ Copy στα δικά σου accounts με όποιο εργαλείο θες — μία στρατηγική ανά χρήστη.", note: "HFT cap: ≤50% των trades κάτω από 1′. All-in σε ένα trade = απαγορεύεται (μπορεί να επιβληθεί 1%/idea)." },
    alloc: { overall: "Cap $500K ανά προϊόν. Το 2026 lineup είναι ΟΛΟ 1-phase (SimFi rebrand)· τα παλιά 2-step/3-step ΔΕΝ πωλούνται.", copyCap: "Όρια ανά νοικοκυριό/IP." },
    programs: [
      { name: "E8 One (1-Phase)", sizes: [S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "FX 1:30 · Indices/Metals 1:15 · Crypto 1:1", daily: "Custom στο checkout: 3% default (3/4/5.3/6.6/9.2%) — σταθερό $ ποσό = X% του ΑΡΧΙΚΟΥ, αφαιρείται από το balance έναρξης της μέρας· hard breach tick-by-tick σε equity", max: "Custom: 4% default (4/6/8/10/14%) DYNAMIC — κάνει trail στο ψηλότερο ΚΛΕΙΣΤΟ balance (το floating ΔΕΝ το κουνάει)· κλειδώνει ΜΟΝΙΜΑ στο αρχικό", target: "Custom: 6% default (6/9/12/15/21% αναλόγως DD)", mindays: "Καμία", time: "Unlimited", news: "Ελεύθερο στο challenge", weekend: "Επιτρέπεται", trap: "60ήμερο inactivity. Το «daily trailing equity» που γράφουν τρίτοι είναι ΛΑΘΟΣ — το daily είναι σταθερό $ από το balance της μέρας." },
        funded: { lev: "FX 1:30", daily: "ίδιο custom", max: "ίδιο dynamic, κλειδωμένο στο αρχικό μετά το lock", target: "—", split: "80/90/100% — το διάλεξες στο checkout", payout: "On-demand· min payout > 50% του daily DD· 1ο δυνατό ~3 μέρες", news: "✗ ±5′ ban (και SL/TP/stops· ομιλίες: όλη τη διάρκεια) — ενφορσάρεται ΑΝΑΔΡΟΜΙΚΑ στο payout review", weekend: "Επιτρέπεται", trap: "ΤΟ θανάσιμο: το loss level ΔΕΝ κάνει reset μετά από payout — αν τραβήξεις όλο το profit αφού κλειδώσει το πάτωμα στο αρχικό, το account ΚΑΗΚΕ. Άφηνε 2-3% μέσα." } },
      { name: "E8 Pro (1-Phase)", sizes: [S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "FX 1:30", daily: "2.5% του αρχικού, από το balance έναρξης της μέρας· hard breach", max: "8% STATIC", target: "8%", mindays: "Καμία", time: "Unlimited", news: "✓ ΤΕΛΕΙΩΣ ελεύθερο", weekend: "Επιτρέπεται", trap: "2% DAILY PROFIT CAP: ό,τι κερδίσεις πάνω από 2% τη μέρα ΑΦΑΙΡΕΙΤΑΙ αυτόματα στο rollover — μετράει και στο challenge!" },
        funded: { lev: "FX 1:30", daily: "2.5%", max: "8% static (πάει στο αρχικό μετά το 1ο payout)", target: "—", split: "80/90/100% (checkout)", payout: "ΚΑΘΗΜΕΡΙΝΑ on-demand, min 1% του αρχικού· 50% των κερδών γίνεται requestable, το υπόλοιπο buffer", news: "✓ Ελεύθερο", weekend: "Επιτρέπεται", trap: "Το 2% profit cap «σβήνει» τις μεγάλες μέρες σου σιωπηλά — χτίσε σταθερά, όχι εκρηκτικά." } },
    ],
  },
  {
    name: "Goat Funded Trader",
    eurOffered: false,
    calLink: "https://help.goatfundedtrader.com/",
    calLabel: "GFT Help (news ±5′ profit cap 1%· Goat Guard −2%)",
    summary: { models: "1-Step, 2-Step Std/GOAT, 3-Step, Instant ×4", sizes: "$5K–$200K", lev: "1:100 eval / 1:50 funded", daily: "3–5% (reset 5pm EST)", max: "5–10%", target: "10 / 10→5 / 8→6 / 6×3", news: "~", weekend: "✓", split: "80% (→95% scaling)", mindays: "3-5 «valid» (≥0.5% profit!)" },
    flags: { news: "~ (επιτρέπεται· ΑΛΛΑ trades που ανοίγουν/κλείνουν ±5′ γύρω από red-folder → κέρδος capped στο 1% του αρχικού, το πλεόνασμα αφαιρείται· ισχύει eval ΚΑΙ funded· μετράνε SL/TP/pending fills)", weekend: "✓ Επιτρέπεται σε όλα τα μοντέλα", consistency: "~ (2-step/1-step/3-step: όχι· Instant tiers: 15–20%· Pay Later funded: 20%)" },
    copy: { cross: "✗ Signals/τρίτοι = ban. Eval→eval και eval→funded copy ΔΕΝ επιτρέπεται.", own: "✓ ΜΟΝΟ funded→funded copy μεταξύ δικών σου.", note: "Hedging (αντίθετες θέσεις, ακόμα και στο ίδιο account), martingale/grid, έτοιμα EAs = ban. Funded: trades <2′ χάνουν το κέρδος στο payout." },
    alloc: { overall: "Funded: $3.000/μέρα profit cap (το πλεόνασμα αφαιρείται)· πρώτα 2 payouts capped στο min(6%, $10K).", copyCap: "Goat Guard (funded, όχι Instant): auto-close ΟΛΩΝ στο −2% floating· 1η φορά → split 50%· 2η → breach." },
    programs: [
      { name: "1-Step", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "FX 1:100 · Idx/Comm 1:20 · Crypto 1:2", daily: "3% (από 1/8/26 — ήταν 4%)· reset 5pm EST· βάση: το ΜΕΓΑΛΥΤΕΡΟ balance/equity στο reset", max: "6% static", target: "10%", mindays: "3 «valid days» (μέρα με ≥0.5% κέρδος — όχι απλώς trade!)", time: "Unlimited", news: "±5′ → κέρδος capped 1%", weekend: "Επιτρέπεται", trap: "Το 73% των breaches στην GFT είναι daily DD: αν έχεις floating profit στις 5pm EST, το anchor ανεβαίνει — το giveback σε κόβει ΠΑΝΩ από το κλειστό balance." },
        funded: { lev: "FX 1:50 · Idx/Comm 1:10", daily: "3%", max: "6% static", target: "—", split: "80% (100% add-on)· scaling έως 95% + 50% capital", payout: "Κάθε 14 μέρες· 4 valid days min (από 27/7/26)", news: "±5′ → cap 1%", weekend: "Επιτρέπεται", trap: "Goat Guard: −2% συνδυασμένο floating → όλα κλείνουν· 1η = μισός split, 2η = τέλος." } },
      { name: "2-Step Standard", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "FX 1:100", daily: "5% (higher of balance/equity, 5pm EST)", max: "10% static", target: "P1: 10% · P2: 5%", mindays: "3 valid ανά phase", time: "Unlimited", news: "±5′ → cap 1%", weekend: "Επιτρέπεται", trap: "«Valid day» = ≥0.5% κέρδος. Μέρες με trading χωρίς κέρδος ΔΕΝ μετράνε — έλεγξε το μετρητή σου." },
        funded: { lev: "FX 1:50", daily: "5%", max: "10% static", target: "—", split: "80% (→95% scaling)", payout: "Κάθε 14 μέρες· 4 valid days (από 25/7/26)· $3K/day cap", news: "±5′ → cap 1%", weekend: "Επιτρέπεται", trap: "Πρώτα 2 payouts: max min(6% του size, $10K) — μην υπολογίζεις σε μεγάλη πρώτη ανάληψη." } },
      { name: "2-Step GOAT", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "FX 1:100", daily: "4%", max: "10% static", target: "P1: 8% · P2: 6%", mindays: "3 valid ανά phase", time: "Unlimited", news: "±5′ → cap 1%", weekend: "Επιτρέπεται", trap: "P2 6% (όχι 5%) — λίγο ψηλότερο από αλλού." },
        funded: { lev: "FX 1:50", daily: "4%", max: "10% static", target: "—", split: "80% (→95%)", payout: "14 μέρες· 4 valid days", news: "±5′ → cap 1%", weekend: "Επιτρέπεται", trap: "Goat Guard −2% + $3K/day cap." } },
      { name: "3-Step", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "FX 1:100", daily: "4%", max: "8% static", target: "6% / 6% / 6%", mindays: "Καμία στο evaluation", time: "Unlimited", news: "±5′ → cap 1%", weekend: "Επιτρέπεται", trap: "Χωρίς min days στο eval — αλλά στο funded θέλεις 4 valid (≥0.5%) για payout." },
        funded: { lev: "FX 1:50", daily: "4%", max: "8% static", target: "—", split: "80% (→95%)", payout: "14 μέρες", news: "±5′ → cap 1%", weekend: "Επιτρέπεται", trap: "8% συνολικό — μικρότερο buffer από το 2-Step Standard." } },
      { name: "Instant (GOAT/PRO/Premium/HERO)", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000)],
        eval: { lev: "FX 1:50", daily: "GOAT/Premium/HERO: 3%· PRO: κανένα", max: "GOAT: 6% trailing equity (reset μετά από payout)· PRO: 4% trailing· Premium: 6% EOD-trailing balance· HERO: 5% trailing", target: "Χωρίς target", mindays: "5 valid (HERO: 6)", time: "—", news: "±5′ → cap 1%", weekend: "Επιτρέπεται", trap: "ΞΕΧΩΡΙΣΤΟ hard breach σε floating loss: GOAT/PRO −2% · Premium −1.5% · HERO −1% — ΧΩΡΙΣ Goat Guard προστασία, κλείσιμο οριστικό." },
        funded: { lev: "FX 1:50", daily: "3% (PRO: —)", max: "trailing κατά tier", target: "—", split: "80% (HERO: 90%)", payout: "GOAT/PRO/HERO: 14 μέρες· Premium: 10· consistency 15–20% (Premium: όχι)", news: "±5′ → cap 1%", weekend: "Επιτρέπεται", trap: "Στο HERO το −1% floating breach σημαίνει: ένα κακό άνοιγμα = τέλος. Μικρές θέσεις ή τίποτα." } },
    ],
  },
  {
    name: "BrightFunded",
    eurOffered: false,
    calLink: "https://help.brightfunded.com/",
    calLabel: "BrightFunded Help (2.0 από 13/4/26· news ±5′ funded)",
    summary: { models: "1-Step, 2-Step Bright, 2-Step Classic", sizes: "$5K–$200K (cap $400K)", lev: "έως 1:100", daily: "3–5% (EOD HWM)", max: "6% trailing / 8–10% static", target: "10 / 8→5 / 10→5", news: "~", weekend: "✓", split: "80% (90% add-on)", mindays: "5/phase (add-on αφαιρεί)" },
    flags: { news: "~ (evaluation ελεύθερα· funded: ±5′ ban σε execution/SL/TP — soft breach, κέρδη αφαιρούνται· trades ανοιχτά ≥48h εξαιρούνται για TP)", weekend: "✓ Επιτρέπεται παντού (swap-free add-on)", consistency: "Όχι — κανένας κανόνας, κανένα profit cap" },
    copy: { cross: "✗ Cross-account hedging, συντονισμένο multi-account, HFT, tick scalping, grid, arbitrage = ban.", own: "✓ Copy μόνο μεταξύ ΔΙΚΩΝ σου accounts (και σε άλλα firms/brokers).", note: "Trade πρέπει να μείνει ανοιχτό ≥60″ για το inactivity — pending orders δεν μετράνε." },
    alloc: { overall: "Max $400K funded. 1ο payout 30 μέρες μετά το 1ο funded trade, μετά κάθε 14 (7ήμερο add-on)· +15% bonus των eval profits στο +10% growth.", copyCap: "—" },
    programs: [
      { name: "1-Step", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "έως 1:100", daily: "3% — βάση το ΜΕΓΑΛΥΤΕΡΟ equity/balance στην αρχή της μέρας (rollover 23:30–23:59 CET)", max: "6% TRAILING ΣΕ ΠΡΑΓΜΑΤΙΚΟ ΧΡΟΝΟ από το equity HWM (και το FLOATING το ανεβάζει!)· κλειδώνει στο αρχικό στα +6%", target: "10%", mindays: "5 (add-on το αφαιρεί)", time: "Unlimited", news: "Ελεύθερο στο evaluation", weekend: "Επιτρέπεται", trap: "ΠΡΟΣΟΧΗ: +$4K floating ανεβάζει το πάτωμα ΧΩΡΙΣ να κλείσεις — αναποδιά που κλείνει −$3.5K σε κόβει ενώ είσαι πάνω από το «αρχικό−6%»." },
        funded: { lev: "έως 1:100", daily: "3%", max: "6% trailing (κλειδωμένο)", target: "—", split: "80% (90% add-on, scaling έως 100%)", payout: "1ο στις 30 μέρες, μετά κάθε 14· 15% των eval profits πιστώνεται", news: "±5′ ban (soft breach)", weekend: "Επιτρέπεται", trap: "Το floating-trailing είναι το πιο επιθετικό DD του καταλόγου — κλείδωνε κέρδη με partial closes." } },
      { name: "2-Step Bright", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "έως 1:100", daily: "4% (EOD higher of equity/balance)", max: "8% static", target: "P1: 8% · P2: 5%", mindays: "5 ανά phase", time: "Unlimited", news: "Ελεύθερο", weekend: "Επιτρέπεται", trap: "Το EOD HWM daily: floating profit στο rollover ανεβάζει το αυριανό breach level." },
        funded: { lev: "έως 1:100", daily: "4%", max: "8% static", target: "—", split: "80% (90% add-on)", payout: "30 μέρες → κάθε 14", news: "±5′ ban", weekend: "Επιτρέπεται", trap: "Καμία consistency — αλλά το 1ο payout στις 30 μέρες θέλει υπομονή." } },
      { name: "2-Step Classic", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "έως 1:100", daily: "5%", max: "10% static", target: "P1: 10% · P2: 5%", mindays: "5 ανά phase", time: "Unlimited", news: "Ελεύθερο", weekend: "Επιτρέπεται", trap: "Ο κλασικός 10/5 συνδυασμός — τα «Original» accounts (προ 13/4/26) έχουν άλλα rules." },
        funded: { lev: "έως 1:100", daily: "5%", max: "10% static", target: "—", split: "80% (90% add-on)", payout: "30 μέρες → κάθε 14", news: "±5′ ban", weekend: "Επιτρέπεται", trap: "Trades <60″ δεν μετράνε πουθενά καλά — απόφυγε tick scalping (banned)." } },
    ],
  },
  {
    name: "Moneta Funded",
    eurOffered: false,
    calLink: "https://monetafunded.com/general-rules/",
    calLabel: "Moneta Funded Rules (news ±5′ ΚΑΙ στο evaluation!)",
    summary: { models: "1-Step, 2-Step, Instant, Instant Pro, Phoenix, Sprint", sizes: "$2.5K–$200K", lev: "1:30 (2-Step 1:100)", daily: "3–5% (22:00 UTC)", max: "6–10% static / 5–8% trailing", target: "10 / 5→10", news: "✗ σχεδόν παντού", weekend: "✓", split: "88%", mindays: "3 profitable/phase" },
    flags: { news: "✗ ΠΡΟΣΟΧΗ: restricted σε ΟΛΑ πλην Instant Pro — και στο EVALUATION: όχι open/close (και SL/TP fills) ±5′ γύρω από red-folder, σε ΚΑΘΕ instrument του νομίσματος (metals/oil = USD)· εξαίρεση θέσεις ανοιχτές ≥2h πριν· παράβαση = αφαίρεση κερδών", weekend: "✓ Επιτρέπεται (πλην Sprint restrictions)· τα Monday gaps μετράνε στο daily", consistency: "~ (μόνο Instant: 15% ή 20% επιλογή στην αγορά· Instant Pro/λοιπά: όχι)" },
    copy: { cross: "✗ Τρίτα/εμπορικά EAs και signals = ban. Account sharing = ban. Video verification κατά την κρίση τους.", own: "✓ Copy μόνο μεταξύ δικών σου accounts· ΜΟΝΟ δικά σου custom EAs.", note: "Νέα εταιρεία (Δεκ 2025), 100% backed από Moneta Markets. 88% split παντού." },
    alloc: { overall: "Payouts κάθε 14 μέρες, min $100, 24–48h processing. Sprint: 100% άμεσα.", copyCap: "1 trade / 30 μέρες αλλιώς auto-breach (χωρίς εξαιρέσεις)." },
    programs: [
      { name: "1-Step", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:30", daily: "3% — από το ΜΕΓΑΛΥΤΕΡΟ balance/equity στις 22:00 UTC, ποσό υπολογισμένο στο ΑΡΧΙΚΟ μέγεθος", max: "6% static", target: "10% (μόνο κλειστές θέσεις)", mindays: "3 profitable (≥0.5%)", time: "Unlimited", news: "✗ ±5′ red-folder ΚΑΙ στο evaluation", weekend: "Επιτρέπεται", trap: "Εδώ το news rule ισχύει ΑΠΟ ΤΟ CHALLENGE — SL fill μέσα στο 10λεπτο = αφαίρεση/παράβαση. Σχεδόν κανείs δεν το περιμένει." },
        funded: { lev: "1:30", daily: "3%", max: "6% static", target: "—", split: "88%", payout: "Κάθε 14 μέρες (1ο ~14 μέρες μετά το 1ο trade), min $100", news: "✗ ±5′", weekend: "Επιτρέπεται", trap: "Μπορεί να επιβληθούν προσωρινά risk-per-trade όρια στο funded." } },
      { name: "2-Step", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:100", daily: "5% (4% με add-on config)", max: "10% static (8% με config)", target: "P1: 5% · P2: 10% — ΝΑΙ, το P2 είναι το ΜΕΓΑΛΟ (ασυνήθιστο!)", mindays: "3 profitable ανά phase", time: "Unlimited", news: "✗ ±5′ και στο evaluation", weekend: "Επιτρέπεται", trap: "Μην χαλαρώσεις μετά το εύκολο P1 5% — το δύσκολο μισό (10%) είναι το P2." },
        funded: { lev: "1:100", daily: "5%", max: "10% static", target: "—", split: "88%", payout: "14 μέρες, min $100", news: "✗ ±5′", weekend: "Επιτρέπεται", trap: "Daily από το 22:00 UTC snapshot με ποσό στο αρχικό μέγεθος — ΣΚ gaps το χτυπάνε." } },
      { name: "Instant Funding", sizes: [S(2500), S(5000), S(10000), S(25000), S(50000)],
        eval: { lev: "1:30", daily: "3%", max: "5% trailing (η σελίδα προϊόντος λέει 6% static — οι επίσημες πηγές ΣΥΓΚΡΟΥΟΝΤΑΙ, υπολόγισε με το χειρότερο: 5% trailing)", target: "Χωρίς target", mindays: "5 profitable", time: "—", news: "✗ ±5′", weekend: "Επιτρέπεται", trap: "Consistency 15% ή 20% (διαλέγεις στην αγορά): best day ≤15/20% του συνολικού profit· reset μετά από κάθε payout." },
        funded: { lev: "1:30", daily: "3%", max: "5% trailing", target: "—", split: "88%", payout: "14 μέρες", news: "✗ ±5′", weekend: "Επιτρέπεται", trap: "Με 15% consistency χρειάζεσαι ~7+ ομοιόμορφες κερδοφόρες μέρες πριν από payout." } },
      { name: "Instant Pro", sizes: [S(2500), S(5000), S(10000), S(25000), S(50000)],
        eval: { lev: "1:30", daily: "4%", max: "8% trailing", target: "Χωρίς target", mindays: "—", time: "—", news: "✓ ΤΕΛΕΙΩΣ ελεύθερο (το ΜΟΝΟ Moneta πρόγραμμα χωρίς news rule)", weekend: "Επιτρέπεται", trap: "Χωρίς consistency, χωρίς news rule — γι' αυτό είναι ακριβότερο." },
        funded: { lev: "1:30", daily: "4%", max: "8% trailing", target: "—", split: "88%", payout: "On-demand, μετά 14ήμερα", news: "✓ Ελεύθερο", weekend: "Επιτρέπεται", trap: "Το 8% είναι trailing — κλείδωσε το buffer με σταθερές αναλήψεις." } },
      { name: "Phoenix (Scaling)", sizes: [S(2500), S(5000), S(10000), S(25000), S(50000)],
        eval: { lev: "1:30", daily: "3%", max: "6% static", target: "10% ανά level (11 levels: $2.5K → $2M)", mindays: "3 profitable", time: "Unlimited", news: "✗ ±5′", weekend: "Επιτρέπεται", trap: "Κάθε 10% γίνεται withdrawable credit στο επόμενο level — μακρύ αλλά κλιμακωτό μονοπάτι." },
        funded: { lev: "1:30", daily: "3%", max: "6% static", target: "10%/level", split: "88%", payout: "14 μέρες", news: "✗ ±5′", weekend: "Επιτρέπεται", trap: "Χωρίς consistency — αλλά τα ±5′ news fills παραμονεύουν σε κάθε level." } },
    ],
  },
  {
    name: "Crypto Fund Trader",
    eurOffered: false,
    calLink: "https://cryptofundtrader.com/faq/",
    calLabel: "CFT FAQ ($10K/day profit cap· reverse-trading rule)",
    summary: { models: "2-Phase, 1-Phase, Instant, Break (Bybit)", sizes: "$2.5K–$300K", lev: "1:100 (Advanced) / 1:30 Student", daily: "4–5% (00:05 UTC)", max: "10% static / 6% trailing", target: "8→5 / 10", news: "✓", weekend: "✓ (crypto 24/7)", split: "80% (90% add-on)", mindays: "5/phase" },
    flags: { news: "✓ Ελεύθερο παντού (πλην Ascend promo)", weekend: "✓ Επιτρέπεται· crypto 24/7", consistency: "~ (μόνο Break: best day ≤40%, έλεγχος στο payout· λοιπά: όχι)" },
    copy: { cross: "✗ Cross-user copy/συντονισμός/reverse EAs = ban. Hedging μεταξύ accounts (και με άλλα emails) = ban.", own: "~ Break: μόνο δικά σου, μόνο evaluation. Λοιπά: ασαφές επίσημα — υπόθεσε μόνο δικά σου.", note: "REVERSE RULE: όχι αντίθετες θέσεις στο ίδιο asset ταυτόχρονα ≥60″ (μετράει και BTC/USD vs BTC/EUR)· αντίθετο trade στο ίδιο instrument ΜΟΝΟ αν το πρώτο είναι ανοιχτό ≥24h." },
    alloc: { overall: "Max $300K standard. GAMBLING RULE: max $10.000 profit ανά ΜΕΡΑ και ανά TRADE — το πλεόνασμα αφαιρείται, οι θέσεις μπορεί να κλείσουν με το ζόρι.", copyCap: "Splits/partial closes μιας στρατηγικής = ΕΝΑ trade για το cap." },
    programs: [
      { name: "2-Phase", sizes: [S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:100 (Advanced/MT5/Match-Trader)", daily: "5% — anchor το balance στις 00:05 UTC· breach σε equity", max: "10% static", target: "P1: 8% · P2: 5%", mindays: "5 ανά phase (add-on αφαιρεί)", time: "Unlimited", news: "✓ Ελεύθερο", weekend: "✓ (crypto 24/7)", trap: "$10K/day-ή-per-trade profit cap — μια εκρηκτική crypto μέρα κόβεται στα $10Κ." },
        funded: { lev: "1:100", daily: "5%", max: "10% static", target: "—", split: "80% (90% με +20% fee add-on)", payout: "1ο: 15 traded days ή 30 ημερολογιακές· weekly add-on (7 traded)· ~8h avg processing", news: "✓ Ελεύθερο", weekend: "✓", trap: "Στο payout request κλείνουν ΟΛΑ τα trades σου." } },
      { name: "1-Phase", sizes: [S(10000), S(25000), S(50000), S(100000)],
        eval: { lev: "1:100", daily: "4%", max: "6% TRAILING σε BALANCE (όχι equity): ακολουθεί το ψηλότερο balance· σταματά και κλειδώνει στο αρχικό", target: "10%", mindays: "5", time: "Unlimited", news: "✓", weekend: "✓", trap: "Κάθε νέο balance high ανεβάζει ΜΟΝΙΜΑ το πάτωμα (μέχρι το αρχικό) — μην κάνεις micro-TPs που σηκώνουν το balance χωρίς ουσία." },
        funded: { lev: "1:100", daily: "4%", max: "6% trailing (balance)", target: "—", split: "80% (90% add-on)", payout: "15 traded days / 30 ημέρες· weekly add-on", news: "✓", weekend: "✓", trap: "Reverse rule: ξέχνα τα quick flips στο ίδιο asset μέσα σε 24h." } },
      { name: "Instant", sizes: [S(2500), S(5000), S(10000)],
        eval: { lev: "1:30 FX · 1:20 Idx · 1:5 crypto (Student)", daily: "4%", max: "6% (τύπος ασαφής επίσημα — υπόθεσε trailing)", target: "10% ανά double-up (έως $1.28M)", mindays: "Κανένα για upgrade", time: "—", news: "✓", weekend: "✓", trap: "Split ladder ανά level: 50%→60%→70%→80%→90% — στα πρώτα levels παίρνεις μόνο τα μισά." },
        funded: { lev: "1:30", daily: "4%", max: "6%", target: "10%/level", split: "50–90% κατά level", payout: "Withdrawal & Upgrade χωρίς min days· max 3 ενεργά Instant", news: "✓", weekend: "✓", trap: "Ο δρόμος προς το 90% split περνά από ~5 double-ups." } },
      { name: "Break (Bybit)", sizes: [S(25000), S(50000), S(100000)],
        eval: { lev: "1:100 (Bybit USDT perps)", daily: "—", max: "Trailing loss: 4% του υψηλότερου balance ($25/50K) · 3% ($100K)", target: "Fixed $: $1.250 / $3.000 / $6.000", mindays: "1 traded day", time: "Unlimited· activation fee εντός 30 ημερών από το πέρασμα", news: "✓", weekend: "✓ 24/7", trap: "Μετά το πέρασμα πληρώνεις activation ($138–328) — ξέχασέ το και λήγει." },
        funded: { lev: "1:100", daily: "—", max: "ίδιο trailing", target: "—", split: "80%", payout: "On-demand, ΧΩΡΙΣ min days· consistency best day ≤40% (έλεγχος ΜΟΝΟ στο payout — trade κι άλλο για να «αραιώσεις» και ξαναζήτα)", news: "✓", weekend: "✓", trap: "Max 5 Break final accounts· copy μόνο δικά σου, μόνο στο evaluation." } },
    ],
  },
  {
    name: "Funded Trading Plus",
    eurOffered: false,
    calLink: "https://help.fundedtradingplus.com/",
    calLabel: "FT+ Help (FT+ 2.0 lineup· Symbol Loss Limit 3%)",
    summary: { models: "1-Step Express, 2-Step Classic, Instant", sizes: "$5K–$200K", lev: "1:30 (Classic 1:50)", daily: "4–6% (~17:00 EST)", max: "6% trailing / 8% static", target: "10 / 7→7", news: "✓ (χωρίς window)", weekend: "~", split: "80% → 90% στο +20%", mindays: "Καμία" },
    flags: { news: "✓ Επιτρέπεται επίσημα χωρίς χρονικό παράθυρο — αλλά «coin-flip» τζογάρισμα NFP με τεράστιο margin περνάει από risk review", weekend: "~ (Express/Classic: ΟΚ· Instant: ΟΧΙ — auto-close Παρασκευή 16:30 EST)", consistency: "~ (μόνο Classic: eval 35%/step, funded 50%/κύκλο — μπλοκάρει, δεν κόβει· reset μετά από κάθε payout)" },
    copy: { cross: "✗ Copy από/προς άλλους = μηδενισμός κερδών.", own: "✓ Copy μόνο μεταξύ δικών σου accounts.", note: "Το παλιό lineup (Experienced/Advanced/Master/Premium) ΑΠΟΣΥΡΘΗΚΕ — FT+ 2.0 = Express/Classic/Instant. ⚠ Οι επίσημες σελίδες αντιφάσκουν στο daily reset (23:59 server vs ~17:00 EST) — υπόθεσε 17:00 EST, higher of balance/equity." },
    alloc: { overall: "Risk review σε pass/scale/withdrawal· margin triggers 75%→50% κατά μέγεθος.", copyCap: "Express: 2 live/$200K· Classic: 1 live (όχι μαζί με Express live)· Instant: απεριόριστα." },
    programs: [
      { name: "1-Step Express", sizes: [S(5000), S(12500), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "FX 1:30 · Gold/Idx 1:20 · Oil 1:5 · Crypto 1:2", daily: "4% (higher of balance/equity ~17:00 EST)", max: "6% RELATIVE TRAILING σε BALANCE HWM· κλειδώνει στο αρχικό· τα payouts ΔΕΝ το κατεβάζουν", target: "10%", mindays: "Καμία", time: "Unlimited", news: "✓ Ελεύθερο", weekend: "Επιτρέπεται", trap: "30ήμερο inactivity hard breach (warning email τη μέρα 23). Το trailing ακολουθεί ΚΛΕΙΣΤΟ balance, όχι equity." },
        funded: { lev: "FX 1:30", daily: "4%", max: "6% trailing (balance)", target: "—", split: "80% → 90% αυτόματα στο +20% profit", payout: "Από την 1η μέρα σε profit· μετά κάθε 7 μέρες· min $50", news: "✓ Ελεύθερο", weekend: "Επιτρέπεται", trap: "Payout από μέρα 1 = πραγματικό — αλλά risk review πριν από κάθε ανάληψη." } },
      { name: "2-Step Classic", sizes: [S(5000), S(12500), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "FX 1:50", daily: "4%", max: "8% static (το μόνο static πρόγραμμα)", target: "P1: 7% · P2: 7%", mindays: "Καμία", time: "Unlimited", news: "✓ Ελεύθερο", weekend: "Επιτρέπεται", trap: "3% SYMBOL LOSS LIMIT — HARD BREACH: ένα instrument που χάνει >3% σε μία μέρα (όλες οι θέσεις του αθροισμένες, βάση το χθεσινό 16:59 EST balance) — eval ΚΑΙ funded. Τα στοιβαγμένα gold entries είναι ο κλασικός τρόπος να καείς." },
        funded: { lev: "FX 1:50", daily: "4%", max: "8% static", target: "—", split: "80% → 90% στο +20%", payout: "1ο στις 10 μέρες, μετά κάθε 10· min 1% του αρχικού", news: "✓ Ελεύθερο", weekend: "Επιτρέπεται", trap: "Consistency 50% ανά payout κύκλο (35% στο eval): μια τεράστια μέρα μπλοκάρει την ανάληψη μέχρι να «αραιώσεις»· reset μετά από κάθε payout." } },
      { name: "Instant", sizes: [S(2500), S(5000), S(12500), S(25000), S(50000)],
        eval: { lev: "FX 1:30", daily: "6% (higher of balance/equity, 17:00 EST)", max: "6% relative trailing (balance, κλειδώνει στο αρχικό)", target: "Χωρίς target", mindays: "—", time: "—", news: "✓ Ελεύθερο", weekend: "✗ ΟΧΙ — auto-close Παρασκευή 16:30 EST", trap: "Contract + KYC ΠΡΙΝ το πρώτο payout." },
        funded: { lev: "FX 1:30", daily: "6%", max: "6% trailing", target: "—", split: "80% → 90%", payout: "Από μέρα 1· κάθε 7 μέρες· min $50", news: "✓ Ελεύθερο", weekend: "✗ ΟΧΙ", trap: "6% daily = 6% max: μία κακή μέρα μπορεί να τα πάρει ΟΛΑ — trade μικρά." } },
    ],
  },
];

// ---------- Currency / size helpers ----------
export type Currency = "USD" | "EUR";

export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function sizeShort(n: number, sym: string): string {
  if (n >= 1000000) return sym + (n / 1000000).toFixed(n % 1000000 ? 1 : 0).replace(/\.0$/, "") + "M";
  const k = n / 1000;
  const kd = Math.abs(k - Math.round(k)) < 0.05 ? Math.round(k) : k.toFixed(1);
  return sym + kd + "K";
}

export function sizeValue(firm: Firm, sObj: SizeObj, cur: Currency): { n: number; sym: string } {
  if (cur === "EUR" && firm.eurOffered && sObj.eur) return { n: sObj.eur, sym: "€" };
  return { n: sObj.usd, sym: "$" };
}

export function sizeLabelFor(firm: Firm, sObj: SizeObj, cur: Currency): string {
  const v = sizeValue(firm, sObj, cur);
  return sizeShort(v.n, v.sym);
}

export function sizesSummary(firm: Firm, cur: Currency): string {
  const vals: { n: number; sym: string }[] = [];
  firm.programs.forEach((p) => p.sizes.forEach((s) => vals.push(sizeValue(firm, s, cur))));
  if (!vals.length) return "—";
  const sym = vals[0].sym;
  const min = Math.min(...vals.map((v) => v.n));
  const max = Math.max(...vals.map((v) => v.n));
  return sizeShort(min, sym) + "–" + sizeShort(max, sym) + (firm.eurOffered ? "" : " (USD)");
}
