// Prop Firm dataset — research June 2026 (PropFirmMatch + official pages).
// Bilingual labels are derived at the UI layer; the raw rule text is stored in EL
// (the original research language) and translated/explained by the AI assistant
// when EN is selected. All textual rule fields below are intentionally kept as the
// source-of-truth research strings.

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

export const FIRMS: Firm[] = [
  {
    name: "FTMO",
    eurOffered: true,
    calLink: "https://ftmo.com/en/calendar/",
    calLabel: "FTMO Economic Calendar (restricted news 2′)",
    summary: { models: "2-Step, 1-Step, Swing", sizes: "$10K–$200K (& EUR)", lev: "1:100 (Swing 1:30)", daily: "5% / 3%", max: "10%", target: "10%→5% / 10%", news: "~", weekend: "~", split: "80%→90%", mindays: "Καμία" },
    flags: { news: "~ (evaluation: ΕΛΕΥΘΕΡΑ· funded Standard: όχι ±2′· Swing: πάντα ελεύθερα)", weekend: "~ (funded μόνο Swing)", consistency: "Όχι" },
    copy: { cross: "✗ Απαγορεύεται copy/mirror μεταξύ διαφορετικών ατόμων (account sharing → breach).", own: "✓ Επιτρέπεται copy μεταξύ των δικών σου FTMO accounts (ίδιος trader/στρατηγική).", note: "Όχι group-trading / signal copying από τρίτους." },
    alloc: { overall: "Max $400K συνολικά (π.χ. 2×$200K ή 4×$100K)· έως $2M με Scaling.", copyCap: "Στα δικά σου accounts ισχύει το ίδιο όριο $400K." },
    programs: [
      { name: "2-Step (Standard)", sizes: [SE(10000), SE(25000), SE(50000), SE(100000), SE(200000)],
        eval: { lev: "1:100", daily: "5%", max: "10% (static)", target: "P1: 10% · P2: 5%", mindays: "Καμία (min 4 ημ. trading)", time: "Unlimited", news: "✓ Ελεύθερο — ΚΑΝΕΝΑΣ περιορισμός news στο evaluation (Challenge/Verification)", weekend: "Επιτρέπεται στο evaluation", trap: "Στο evaluation ΔΕΝ υπάρχει news breach — οι περιορισμοί ισχύουν ΜΟΝΟ στο funded (master). Πρόσεξε το static 10% max DD." },
        funded: { lev: "1:100", daily: "5%", max: "10% (static)", target: "—", split: "80% (έως 90%)", payout: "Κάθε 14 ημ. (on-demand διαθέσιμο)", news: "Όχι ±2′ από high-impact news (μόνο στο funded Standard)", weekend: "Όχι σε Standard", trap: "ΕΔΩ ισχύει ο news κανόνας: άνοιγμα/κλείσιμο εντός ±2′ high-impact = hard breach. Standard ΔΕΝ κρατά weekend." } },
      { name: "2-Step (Swing)", sizes: [SE(10000), SE(25000), SE(50000), SE(100000), SE(200000)],
        eval: { lev: "1:30", daily: "5%", max: "10% (static)", target: "P1: 10% · P2: 5%", mindays: "Καμία", time: "Unlimited", news: "Επιτρέπεται (Swing)", weekend: "Επιτρέπεται (Swing)", trap: "Leverage 1:30 (όχι 1:100) — υπολόγισε διαφορετικά το lot size." },
        funded: { lev: "1:30", daily: "5%", max: "10% (static)", target: "—", split: "80% (έως 90%)", payout: "Κάθε 14 ημ.", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Static 10% max παραμένει σκληρό — weekend gap μπορεί να σε βγάλει εκτός." } },
      { name: "1-Step", sizes: [SE(10000), SE(25000), SE(50000), SE(100000), SE(200000)],
        eval: { lev: "1:100", daily: "3%", max: "10% (trailing)", target: "10%", mindays: "Καμία", time: "Unlimited", news: "✓ Ελεύθερο στο evaluation — κανένας news περιορισμός", weekend: "Επιτρέπεται στο evaluation", trap: "Trailing max DD: το όριο σε ακολουθεί στο κέρδος — όχι static. (News breach μόνο στο funded.)" },
        funded: { lev: "1:100", daily: "3%", max: "10% (trailing)", target: "—", split: "90% (Best Day Rule)", payout: "Κάθε 14 ημ.", news: "Όχι ±2′ από high-impact (μόνο funded Standard)", weekend: "Όχι (Standard)", trap: "Best Day Rule: μία μέρα δεν πρέπει να κυριαρχεί στο κέρδος πριν το 1ο payout. + news breach ±2′." } },
    ],
  },
  {
    name: "FundingPips",
    eurOffered: true,
    calLink: "https://app.fundingpips.com/economic-calendar",
    calLabel: "FundingPips Economic Calendar (dashboard· κανόνας ±5′ βάσει Forex Factory red-folder)",
    summary: { models: "2-Step Std, 2-Step Pro, 1-Step, Zero", sizes: "$5K–$200K (& EUR)", lev: "1:100 (1-step 1:50)", daily: "5% / 3% / 4%", max: "10% / 6%", target: "8%→5% / 6%&6%", news: "~", weekend: "~", split: "έως 100%", mindays: "3 ανά phase" },
    flags: { news: "~ (evaluation: ΕΛΕΥΘΕΡΑ· MASTER: όχι ±5′, κέρδος αφαιρείται· Zero: ±10′)", weekend: "~ (challenge ναι· MASTER προσωρινά ΟΧΙ· Zero όχι)", consistency: "~ (35% μόνο σε On-Demand)" },
    copy: { cross: "✗ Απαγορεύεται copy μεταξύ διαφορετικών χρηστών (account sharing → breach).", own: "✓ Επιτρέπεται copy μεταξύ των ΔΙΚΩΝ σου FundingPips accounts.", note: "EAs/copiers στα δικά σου OK· ΟΧΙ HFT/latency arbitrage/tick scalping." },
    alloc: { overall: "Max συνολικό allocation <b>$300K</b> ανά trader.", copyCap: "Copy στα δικά σου accounts → μέσα στο ίδιο όριο $300K." },
    programs: [
      { name: "2-Step Standard", sizes: [SE(5000), SE(10000), SE(25000), SE(50000), SE(100000), SE(200000)],
        eval: { lev: "1:100", daily: "5%", max: "10% (static)", target: "P1: 8% · P2: 5%", mindays: "3 ανά phase", time: "Unlimited", news: "✓ Ελεύθερο στο challenge — ο ±5′ περιορισμός ΔΕΝ ισχύει στο evaluation", weekend: "Επιτρέπεται στο challenge", trap: "Στο evaluation ΔΕΝ υπάρχει news περιορισμός (μόνο στο Master). Risk per trade idea: καταργήθηκε <$25K· 3% για $25K–$50K· 2% για $50K+. (Το παλιό «1% per trade» ΔΕΝ ισχύει.)" },
        funded: { lev: "1:100", daily: "5%", max: "10% (static)", target: "—", split: "80% (έως 100%)", payout: "Weekly 60% / Bi-Weekly 80% / Monthly 100% / On-Demand 90%", news: "Όχι ±5′ από high-impact news", weekend: "⚠ MASTER: προσωρινά ΟΧΙ weekend hold (auto-close, όχι hard breach)", trap: "Consistency 35% ΜΟΝΟ σε On-Demand payout. 8%-target Master → Striking System (4 warnings σε 1.2% floating loss/trade idea → αφαίρεση κέρδους → μείωση split → breach)." } },
      { name: "2-Step Pro", sizes: [SE(5000), SE(10000), SE(25000), SE(50000), SE(100000), SE(200000)],
        eval: { lev: "1:100", daily: "3%", max: "6% (static)", target: "P1: 6% · P2: 6%", mindays: "3 ανά phase", time: "Unlimited", news: "✓ Ελεύθερο στο challenge (ο ±5′ ισχύει μόνο στο Master)", weekend: "Επιτρέπεται στο challenge", trap: "Risk Per Trade Idea: ΚΑΤΑΡΓΗΘΗΚΕ τελείως στο Pro. Όμως σφιχτό DD: 3% daily / 6% max." },
        funded: { lev: "1:100", daily: "3%", max: "6% (static)", target: "—", split: "80% (έως 100%)", payout: "Weekly 80% (μόνο weekly cycle)", news: "Όχι ±5′ από high-impact news", weekend: "⚠ MASTER: προσωρινά ΟΧΙ weekend hold", trap: "Pro = μόνο weekly split (80%), όχι On-Demand. 6% max είναι μικρό· news spike σε φτάνει γρήγορα." } },
      { name: "1-Step", sizes: [SE(5000), SE(10000), SE(25000), SE(50000), SE(100000)],
        eval: { lev: "1:50", daily: "4%", max: "6% (static)", target: "10%", mindays: "3", time: "Unlimited", news: "✓ Ελεύθερο στο challenge (ο περιορισμός news ισχύει μόνο στο Master)", weekend: "Επιτρέπεται στο challenge", trap: "Leverage 1:50 (όχι 1:100). Static 6% max είναι μικρό." },
        funded: { lev: "1:50", daily: "4%", max: "6% (static)", target: "—", split: "80% (έως 100%)", payout: "On-Demand / cycles", news: "Όχι ±5′ από high-impact news", weekend: "⚠ MASTER: προσωρινά ΟΧΙ weekend hold", trap: "Consistency 35% μόνο σε On-Demand. Max 20 lots forex / 1 lot crypto." } },
      { name: "Zero (Instant)", sizes: [SE(5000), SE(10000), SE(25000), SE(50000), SE(100000)],
        eval: { lev: "1:50", daily: "3%", max: "5% (trailing)", target: "Instant — χωρίς challenge", mindays: "—", time: "—", news: "Όχι ±10′ από high-impact (Zero/Instant: πιο αυστηρό 10λεπτο window)", weekend: "Δεν επιτρέπεται", trap: "Zero = πιο αυστηρό 10λεπτο news window (αντί ±5′). Trailing 5% max + ΟΧΙ weekend → εύκολο breach αν δεν κλειδώνεις profit." },
        funded: { lev: "1:50", daily: "3%", max: "5% (trailing)", target: "—", split: "80% (έως 100%)", payout: "cycles", news: "Όχι ±10′ από high-impact (Zero window)", weekend: "Δεν επιτρέπεται", trap: "30 ημέρες inactivity → breach. Zero = 10λεπτο news window." } },
    ],
  },
  {
    name: "FundedNext",
    eurOffered: false,
    calLink: "https://fundednext.com/economic-calendar",
    calLabel: "FundedNext Economic Calendar (δικό της· δείχνει trade-limitation status)",
    summary: { models: "Stellar 2-Step, 1-Step, Lite, Instant", sizes: "$2K–$200K (USD μόνο)", lev: "1:100 (1-step/Instant 1:30)", daily: "5% / 3% / 4%", max: "10% / 6% / 8%", target: "varies", news: "~", weekend: "✓", split: "έως 95%", mindays: "5 benchmark days" },
    flags: { news: "~ (επιτρέπεται· κέρδος ±5′ από high-impact cap)", weekend: "✓ Επιτρέπεται", consistency: "~ (benchmark στο funded)" },
    copy: { cross: "✗ Απαγορεύεται copy μεταξύ διαφορετικών ατόμων.", own: "✓ Επιτρέπεται copy μεταξύ των δικών σου FundedNext accounts.", note: "EAs OK· όχι exploit/HFT." },
    alloc: { overall: "Max συνολικό allocation <b>$300K</b> ανά trader.", copyCap: "Στα δικά σου accounts ισχύει το ίδιο $300K." },
    programs: [
      { name: "Stellar 2-Step", sizes: [S(6000), S(15000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:100", daily: "5%", max: "10% (static)", target: "P1: 8% · P2: 5%", mindays: "—", time: "Unlimited", news: "✓ Ελεύθερο στο evaluation — κανένας news περιορισμός", weekend: "Επιτρέπεται", trap: "Στο evaluation το news trading είναι ελεύθερο. (Ο περιορισμός εφαρμόζεται στο funded.)" },
        funded: { lev: "1:100 (indices ~1:5)", daily: "5%", max: "10% (static)", target: "—", split: "80% (έως 95%)", payout: "5 benchmark days· consistency", news: "News Reward Share: μόνο 40% του κέρδους εντός ±5′ high-impact μετράει", weekend: "Επιτρέπεται", trap: "Στο funded, κέρδος από trades εντός 5′ πριν/μετά high-impact μετράει μόνο κατά 40% (όχι breach). + 5 benchmark ημέρες για payout." } },
      { name: "Stellar 1-Step", sizes: [S(6000), S(15000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:30", daily: "3%", max: "6% (static)", target: "10%", mindays: "—", time: "Unlimited", news: "✓ Ελεύθερο στο evaluation", weekend: "Επιτρέπεται", trap: "Leverage 1:30 + σφιχτό 3%/6% — εύκολο breach σε volatile session. (News Reward Share 40% μόνο στο funded.)" },
        funded: { lev: "1:30", daily: "3%", max: "6% (static)", target: "—", split: "80% (έως 95%)", payout: "Benchmark / consistency", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Benchmark/consistency απαιτείται για payout." } },
      { name: "Stellar Lite", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:100", daily: "4%", max: "8% (static)", target: "P1: 8% · P2: 4%", mindays: "—", time: "Unlimited", news: "✓ Ελεύθερο στο evaluation", weekend: "Επιτρέπεται", trap: "8% max (όχι 10%) — λιγότερο buffer. (News Reward Share 40% μόνο στο funded.)" },
        funded: { lev: "1:100", daily: "4%", max: "8% (static)", target: "—", split: "80% (έως 95%)", payout: "—", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Μικρότερο max DD = λιγότερο περιθώριο λάθους." } },
      { name: "Instant", sizes: [S(2000), S(5000), S(10000), S(25000), S(50000), S(100000)],
        eval: { lev: "1:30", daily: "Καμία", max: "6% (trailing)", target: "Instant — χωρίς challenge", mindays: "—", time: "—", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Trailing 6% max — κλειδώνει στο αρχικό μετά από κέρδος." },
        funded: { lev: "1:30", daily: "Καμία", max: "6% (trailing)", target: "—", split: "έως 95%", payout: "—", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Trailing DD = το πιο συχνό αίτιο breach. Κλείδωνε προστασία." } },
    ],
  },
  {
    name: "The5ers",
    eurOffered: false,
    calLink: "https://www.forexfactory.com/calendar",
    calLabel: "Η The5ers χρησιμοποιεί Forex Factory red-folder (±2′ window, server time)",
    summary: { models: "High Stakes (2-step), Hyper Growth (1-step)", sizes: "$2.5K–$100K (USD μόνο)", lev: "1:100 (Hyper 1:30)", daily: "5% / 3%", max: "10% / 6%", target: "8%→5% / 10%", news: "~", weekend: "✓", split: "80%", mindays: "3 profitable days" },
    flags: { news: "~ (κράτημα 2′ γύρω από news στο High Stakes)", weekend: "✓ Επιτρέπεται (overnight & weekend)", consistency: "Όχι" },
    copy: { cross: "✗ Απαγορεύεται copy μεταξύ διαφορετικών ατόμων.", own: "✓ Επιτρέπεται copy μεταξύ των δικών σου The5ers accounts.", note: "EAs OK· όχι managed/3rd-party copy." },
    alloc: { overall: "Scaling έως <b>$4M</b> ανά trader (account διπλασιάζεται με milestones).", copyCap: "Στα δικά σου accounts κράτα συνεπές risk· scaling ανά account." },
    programs: [
      { name: "High Stakes (2-Step)", sizes: [S(2500), S(5000), S(10000), S(25000), S(50000), S(100000)],
        eval: { lev: "1:100 (metals 1:33, indices 1:25)", daily: "5% (από closing equity προηγ. μέρας)", max: "10% (από αρχικό balance)", target: "P1: 8% · P2: 5%", mindays: "3 profitable days", time: "Unlimited", news: "Επιτρέπεται· κράτημα 2′ γύρω από news", weekend: "Επιτρέπεται", trap: "Daily DD από το closing equity/balance προηγ. μέρας (όχι από αρχικό) — το όριο μέρας ανεβαίνει στο κέρδος." },
        funded: { lev: "1:100", daily: "5%", max: "10%", target: "—", split: "80%", payout: "Μετά 14 ημ.· scaling έως $4M", news: "Επιτρέπεται· 2′ window", weekend: "Επιτρέπεται", trap: "3 profitable days ελάχιστο. Το 2′ news window ισχύει και στο funded." } },
      { name: "Hyper Growth (1-Step)", sizes: [S(5000), S(10000), S(20000)],
        eval: { lev: "1:30", daily: "3%", max: "6%", target: "10%", mindays: "—", time: "Unlimited", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Leverage 1:30 + σφιχτό 3% daily — μικρό buffer." },
        funded: { lev: "1:30", daily: "3%", max: "6%", target: "—", split: "80%", payout: "Διπλασιασμός account ανά +10% (έως $4M)", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Scaling απαιτεί +10% ανά βήμα· μην ρισκάρεις το account." } },
    ],
  },
];

// --- Remaining firms appended ---
FIRMS.push(
  {
    name: "Alpha Capital",
    eurOffered: false,
    calLink: "https://www.forexfactory.com/calendar",
    calLabel: "Η Alpha χρησιμοποιεί Forex Factory red-folder (±2′ μόνο σε Zero Qualified funded)",
    summary: { models: "One (1-step), Pro (2-step), Swing, Three (3-step)", sizes: "$5K–$200K (USD μόνο)", lev: "Pro 1:100 · Three 1:50 · One/Swing 1:30", daily: "4%", max: "6% / 10%", target: "varies", news: "~", weekend: "~", split: "80%", mindays: "—" },
    flags: { news: "~ (επιτρέπεται· ενθαρρύνεται στο Swing)", weekend: "~ (ναι σε One/Three/Swing· όχι σε Pro funded)", consistency: "~ (best-day σε ορισμένα)" },
    copy: { cross: "✗ Απαγορεύεται copy μεταξύ διαφορετικών ατόμων.", own: "✓ Επιτρέπεται copy μεταξύ των δικών σου Alpha accounts.", note: "EAs OK· όχι exploit." },
    alloc: { overall: "Max allocation <b>$200K–$400K</b> ανά trader (ανά μοντέλο/scaling).", copyCap: "Στα δικά σου accounts ισχύει το συνολικό όριο." },
    programs: [
      { name: "Alpha One (1-Step)", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:30", daily: "4%", max: "6% (trailing → κλειδώνει στο αρχικό στο +6%)", target: "10%", mindays: "—", time: "Unlimited", news: "Επιτρέπεται", weekend: "Επιτρέπεται (swap fees)", trap: "Trailing max που κλειδώνει στο αρχικό στο +6%. Leverage 1:30." },
        funded: { lev: "1:30", daily: "4%", max: "6%", target: "—", split: "80%", payout: "Bi-weekly / on-demand", news: "Όχι ±2′ από news (μόνο στο Zero Qualified funded)", weekend: "Επιτρέπεται", trap: "Στο Zero Qualified funded: όχι entry εντός ±2′ από news. (Advanced/Premium funded: χωρίς news περιορισμό.) + consistency." } },
      { name: "Alpha Pro (2-Step)", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:100", daily: "4%", max: "10% (static)", target: "P1: 10% · P2: 5%", mindays: "—", time: "Unlimited", news: "Επιτρέπεται", weekend: "Επιτρέπεται στο evaluation", trap: "Weekend OK στο evaluation — αλλά ΟΧΙ στο funded του ίδιου μοντέλου (δες κάτω)." },
        funded: { lev: "1:100", daily: "4%", max: "10%", target: "—", split: "80%", payout: "Bi-weekly / on-demand", news: "Επιτρέπεται", weekend: "⚠ ΔΕΝ επιτρέπεται στο funded Pro", trap: "ΠΑΓΙΔΑ: πέρασες κρατώντας weekend, αλλά στο funded Pro το weekend ΑΠΑΓΟΡΕΥΕΤΑΙ. Κλείσε Παρασκευή." } },
      { name: "Alpha Swing (2-Step)", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:30", daily: "4%", max: "10% (static)", target: "P1: 10% · P2: 5%", mindays: "—", time: "Unlimited", news: "Ενθαρρύνεται", weekend: "Επιτρέπεται", trap: "Leverage 1:30 — υπολόγισε σωστά το lot size." },
        funded: { lev: "1:30", daily: "4%", max: "10%", target: "—", split: "80%", payout: "Bi-weekly / on-demand", news: "Ενθαρρύνεται", weekend: "Επιτρέπεται (και στο funded)", trap: "Το μόνο Alpha μοντέλο με weekend hold και στο funded." } },
      { name: "Alpha Three (3-Step)", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:50", daily: "4%", max: "6% (static)", target: "P1: 8% · P2: 4% · P3: 4%", mindays: "—", time: "Unlimited", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "3 phases = περισσότερος χρόνος εκτεθειμένος στο σφιχτό 6% max." },
        funded: { lev: "1:50", daily: "4%", max: "6%", target: "—", split: "80%", payout: "Bi-weekly / on-demand", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "6% max DD = λίγο buffer στο funded." } },
    ],
  },
  {
    name: "Hola Prime",
    eurOffered: false,
    calLink: "https://www.forexfactory.com/calendar",
    calLabel: "Η Hola Prime χρησιμοποιεί Forex Factory red-folder ως αναφορά",
    summary: { models: "1-Step / 2-Step (Prime & Pro), Direct", sizes: "$5K–$300K (USD μόνο)", lev: "Pro 1:100 · Prime 1:30", daily: "3% / 5%", max: "4%–10%", target: "10% / 8%→5%", news: "~", weekend: "~", split: "έως 90%", mindays: "—" },
    flags: { news: "~ (challenge ελεύθερα· funded πιθανοί περιορισμοί)", weekend: "~ (challenge· overnight OK)", consistency: "—" },
    copy: { cross: "✗ Απαγορεύεται copy μεταξύ διαφορετικών ατόμων.", own: "✓ Επιτρέπεται copy μεταξύ των δικών σου Hola Prime accounts.", note: "EAs OK· όχι 3rd-party managed copy." },
    alloc: { overall: "Max allocation έως <b>$300K</b> ανά trader (scaling υψηλότερα).", copyCap: "Στα δικά σου accounts ισχύει το συνολικό όριο." },
    programs: [
      { name: "1-Step Prime", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000), S(300000)],
        eval: { lev: "1:30 (Prime) / 1:100 (Pro variant)", daily: "3%", max: "4% trailing – 6% static (ανά μοντέλο)", target: "10%", mindays: "—", time: "Unlimited", news: "Επιτρέπεται στο challenge", weekend: "Επιτρέπεται στο challenge", trap: "4% = TRAILING, 6% = STATIC. Διάλεξε σωστά — το trailing σε ακολουθεί." },
        funded: { lev: "1:30 / 1:100", daily: "3%", max: "4%–6%", target: "—", split: "έως 90%", payout: "On-demand", news: "Πιθανοί περιορισμοί", weekend: "Πιθανοί περιορισμοί", trap: "Επιβεβαίωσε στο dashboard αν το funded έχει news/weekend περιορισμούς." } },
      { name: "2-Step Pro", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000), S(300000)],
        eval: { lev: "1:100", daily: "5%", max: "6%–10% (ανά μοντέλο)", target: "P1: 8% · P2: 5%", mindays: "—", time: "Unlimited", news: "Επιτρέπεται στο challenge", weekend: "Επιτρέπεται στο challenge", trap: "Πολλά sub-μοντέλα με διαφορετικό max DD — διάβασε το ακριβές πλάνο." },
        funded: { lev: "1:100", daily: "5%", max: "6%–10%", target: "—", split: "έως 90%", payout: "On-demand", news: "Πιθανοί περιορισμοί", weekend: "Πιθανοί περιορισμοί", trap: "Επιβεβαίωσε funded news/weekend rules πριν κρατήσεις θέση." } },
      { name: "Direct (Instant)", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000)],
        eval: { lev: "ανά μοντέλο", daily: "—", max: "—", target: "Instant — χωρίς challenge", mindays: "—", time: "—", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Instant = πιο σφιχτά risk limits από το πρώτο trade." },
        funded: { lev: "ανά μοντέλο", daily: "Βλ. πλάνο", max: "Βλ. πλάνο", target: "—", split: "έως 90%", payout: "On-demand", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Διάβασε το συγκεκριμένο instant πλάνο — διαφέρει ανά μέγεθος." } },
    ],
  },
  {
    name: "E8 Markets",
    eurOffered: false,
    calLink: "https://www.forexfactory.com/calendar",
    calLabel: "Η E8 χρησιμοποιεί Forex Factory (Tier-1 events· ±5′ μόνο στο funded)",
    summary: { models: "E8 One, E8 Standard/Signature", sizes: "$25K–$200K (USD μόνο)", lev: "1:30 (One) · 1:50 eval→1:30 funded (Std)", daily: "3% (προσαρμόσιμο)", max: "4%–14% (επιλογή)", target: "6% (One)", news: "~", weekend: "~", split: "80%→100%", mindays: "—" },
    flags: { news: "~ (challenge ελεύθερα· funded όχι ±5′ από high-impact)", weekend: "~ (ανά τύπο account)", consistency: "~ (40% best-day)" },
    copy: { cross: "✗ Απαγορεύεται copy μεταξύ διαφορετικών ατόμων.", own: "✓ Επιτρέπεται copy μεταξύ των δικών σου E8 accounts.", note: "EAs OK· όχι exploit/HFT." },
    alloc: { overall: "Max allocation <b>$400K</b> ανά trader (scaling έως $1M+).", copyCap: "Στα δικά σου accounts ισχύει το συνολικό όριο." },
    programs: [
      { name: "E8 One", sizes: [S(25000), S(50000), S(100000), S(150000), S(200000)],
        eval: { lev: "1:30 (indices/metals 1:15, crypto 1:1)", daily: "3% (προσαρμόσιμο)", max: "4%–14% (επιλογή)", target: "6%", mindays: "—", time: "Unlimited", news: "Ελεύθερο στο challenge", weekend: "Ανάλογα τη ρύθμιση", trap: "Διαλέγεις max DD στην αγορά (4%–14%) — χαμηλό = φθηνό αλλά εύκολο breach. Leverage 1:30." },
        funded: { lev: "1:30", daily: "3% (προσαρμόσιμο)", max: "4%–14%", target: "—", split: "80% (+10%/profitable day έως 100%)", payout: "—", news: "Όχι ±5′ από high-impact news", weekend: "Περιορισμοί ανά τύπο account", trap: "ΠΑΓΙΔΑ: news ελεύθερα στο challenge αλλά ΑΠΑΓΟΡΕΥΟΝΤΑΙ ±5′ γύρω από high-impact στο funded." } },
      { name: "E8 Standard / Signature", sizes: [S(25000), S(50000), S(100000), S(150000)],
        eval: { lev: "1:50", daily: "3% (default)", max: "6% / 8% / 10% / 14% (επιλογή)", target: "Ανά πλάνο", mindays: "—", time: "Unlimited", consistency: "40% best-day", news: "Ελεύθερο στο challenge", weekend: "Ανάλογα τη ρύθμιση", trap: "Consistency 40% best-day: καμία μέρα >40% του κέρδους. Leverage πέφτει στο funded." },
        funded: { lev: "1:30", daily: "3%", max: "6%–14%", target: "—", split: "80%→100%", payout: "—", consistency: "40% best-day", news: "Όχι ±5′ από high-impact news", weekend: "Περιορισμοί ανά τύπο", trap: "Leverage πέφτει 1:50→1:30 στο funded + news-restricted + 40% consistency." } },
    ],
  },
  {
    name: "Goat Funded Trader",
    eurOffered: false,
    calLink: "https://www.forexfactory.com/calendar",
    calLabel: "Η GOAT χρησιμοποιεί Forex Factory / Myfxbook red-folder (cap 1% ±5′)",
    summary: { models: "2-Step Std/GOAT/Pro, 1-Step, Instant", sizes: "$5K–$400K (USD μόνο)", lev: "1:100 (Instant funded 1:50)", daily: "5% / 4% / 3%", max: "10%", target: "8%→6%", news: "~", weekend: "✓", split: "80%→100%", mindays: "—" },
    flags: { news: "~ (κέρδος ±5′ από news cap 1% του αρχικού)", weekend: "✓ Επιτρέπεται", consistency: "—" },
    copy: { cross: "✗ Απαγορεύεται copy μεταξύ διαφορετικών ατόμων.", own: "✓ Επιτρέπεται copy μεταξύ των δικών σου GOAT accounts.", note: "EAs OK· όχι exploit." },
    alloc: { overall: "Max allocation <b>$400K</b> ανά trader (έως $2M με scaling).", copyCap: "Στα δικά σου accounts ισχύει το συνολικό όριο." },
    programs: [
      { name: "2-Step Standard", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000), S(400000)],
        eval: { lev: "1:100 (indices/commodities 1:20, crypto 1:2)", daily: "5%", max: "10% (static)", target: "P1: 8% · P2: 6%", mindays: "—", time: "Unlimited", news: "Κέρδος ±5′ από news cap 1% αρχικού", weekend: "Επιτρέπεται", trap: "News profit cap 1%: κέρδος γύρω από high-impact πάνω από 1% του αρχικού δεν μετράει." },
        funded: { lev: "1:100", daily: "5%", max: "10%", target: "—", split: "80% (έως 100%)", payout: "—", news: "Cap 1% κοντά σε news", weekend: "Επιτρέπεται", trap: "Ο 1% news-cap ισχύει και στο funded — μην βασιστείς σε news spike." } },
      { name: "2-Step GOAT / Pro", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000), S(400000)],
        eval: { lev: "1:100", daily: "4%", max: "10% (static)", target: "Ανά πλάνο", mindays: "—", time: "Unlimited", news: "Cap 1% κοντά σε news", weekend: "Επιτρέπεται", trap: "Σφιχτότερο daily (4%) από το Standard." },
        funded: { lev: "1:100", daily: "4%", max: "10%", target: "—", split: "80% (έως 100%)", payout: "—", news: "Cap 1% κοντά σε news", weekend: "Επιτρέπεται", trap: "1% news-cap ισχύει· τήρησε συνεπές risk." } },
      { name: "1-Step", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:100", daily: "4%", max: "10% (static)", target: "Ανά πλάνο", mindays: "—", time: "Unlimited", news: "Cap 1% κοντά σε news", weekend: "Επιτρέπεται", trap: "Έλεγξε αν το 1-step έχει trailing ή static — διαφέρει ανά promo." },
        funded: { lev: "1:100", daily: "4%", max: "10%", target: "—", split: "80% (έως 100%)", payout: "—", news: "Cap 1% κοντά σε news", weekend: "Επιτρέπεται", trap: "1% news-cap στο funded επίσης." } },
      { name: "Instant GOAT", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000)],
        eval: { lev: "1:100", daily: "3%", max: "10%", target: "Instant — χωρίς challenge", mindays: "—", time: "—", news: "Cap 1% κοντά σε news", weekend: "Επιτρέπεται", trap: "Instant = σφιχτό 3% daily από το πρώτο trade." },
        funded: { lev: "1:50 (funded)", daily: "3%", max: "10%", target: "—", split: "80% (έως 100%)", payout: "—", news: "Cap 1% κοντά σε news", weekend: "Επιτρέπεται", trap: "Leverage πέφτει σε 1:50 στο funded Instant. Τήρησε 3% daily αυστηρά." } },
    ],
  },
  {
    name: "BrightFunded",
    eurOffered: false,
    calLink: "https://www.forexfactory.com/calendar",
    calLabel: "Η BrightFunded χρησιμοποιεί Forex Factory red-folder ως αναφορά",
    summary: { models: "2-Step (Original)", sizes: "$5K–$200K (USD μόνο)", lev: "1:100", daily: "5%", max: "10%", target: "8%→5%", news: "~", weekend: "~", split: "80%→100%", mindays: "Καμία (no consistency)" },
    flags: { news: "~ (μην κρατάς σε high-impact news εκτός αν επιτρέπεται)", weekend: "~ (μην κρατάς weekend εκτός αν επιτρέπεται)", consistency: "Όχι" },
    copy: { cross: "✗ Απαγορεύεται copy μεταξύ διαφορετικών ατόμων.", own: "✓ Επιτρέπεται copy μεταξύ των δικών σου BrightFunded accounts.", note: "EAs OK· όχι 3rd-party managed copy." },
    alloc: { overall: "Max allocation <b>$200K</b> base· split 80%→100% μετά 3 scale-ups + Trade2Earn.", copyCap: "Στα δικά σου accounts ισχύει το συνολικό όριο." },
    programs: [
      { name: "2-Step (Original)", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:100 (commodities 1:40, indices 1:20, crypto 1:5)", daily: "5% (static, από αρχικό)", max: "10% (static)", target: "P1: 8% · P2: 5%", mindays: "Καμία", time: "Unlimited", consistency: "Καμία", news: "Μην κρατάς σε high-impact news (εκτός αν επιτρέπεται)", weekend: "Μην κρατάς weekend (εκτός αν επιτρέπεται)", trap: "Daily DD static από αρχικό balance. Μην κρατάς θέση σε high-impact news ή weekend." },
        funded: { lev: "1:100 (σταθερό, χωρίς μείωση)", daily: "5%", max: "10%", target: "—", split: "80% → 100% (μετά 3 scale-ups) + Trade2Earn", payout: "—", consistency: "Καμία", news: "Όπως στο challenge", weekend: "Όπως στο challenge", trap: "Δεν υπάρχει consistency (καλό), αλλά οι news/weekend κανόνες ισχύουν και στο funded." } },
    ],
  },
  {
    name: "Moneta Funded",
    eurOffered: false,
    calLink: "https://www.forexfactory.com/calendar",
    calLabel: "Η Moneta χρησιμοποιεί Forex Factory (news επιτρέπεται εντός risk limits)",
    summary: { models: "2-Step, 1-Step, Phoenix, Instant", sizes: "$2.5K–$2M (scaling, USD μόνο)", lev: "2-Step 1:100 · υπόλοιπα 1:30", daily: "5% / 3%", max: "10% / 6%", target: "5%→10% / 10%", news: "✓", weekend: "✓", split: "88%", mindays: "3 profitable days" },
    flags: { news: "✓ Επιτρέπεται (εντός risk limits)", weekend: "✓ Επιτρέπεται", consistency: "~ (20%/μέρα στο Instant)" },
    copy: { cross: "✗ Απαγορεύεται copy μεταξύ διαφορετικών ατόμων.", own: "✓ Επιτρέπεται copy μεταξύ των δικών σου Moneta accounts.", note: "EAs OK· όχι exploit." },
    alloc: { overall: "Scaling έως <b>$2M</b> ανά trader (Phoenix milestones).", copyCap: "Στα δικά σου accounts ισχύει το συνολικό όριο· scaling ανά account." },
    programs: [
      { name: "2-Step", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:100 (crypto 1:20)", daily: "5%", max: "10%", target: "P1: 5% · P2: 10%", mindays: "3 profitable days (≥0.5%)", time: "Unlimited", hold: "min 2′ ανά position", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Min hold 2′ ανά position (anti-scalping). Κλείσιμο πριν τα 2′ μπορεί να μη μετρήσει." },
        funded: { lev: "1:100", daily: "5%", max: "10%", target: "—", split: "88%", payout: "—", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Ο 2′ min-hold κανόνας ισχύει και στο funded." } },
      { name: "1-Step", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:30", daily: "3%", max: "6%", target: "10%", mindays: "3 profitable days", time: "Unlimited", hold: "min 2′ ανά position", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Leverage 1:30 + σφιχτό 3%/6% + min hold 2′. Όχι tick-scalping." },
        funded: { lev: "1:30", daily: "3%", max: "6%", target: "—", split: "88%", payout: "—", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "6% max = λίγο buffer· τήρησε min hold." } },
      { name: "Phoenix Scaling", sizes: [S(2500), S(5000), S(10000), S(25000), S(50000), S(100000)],
        eval: { lev: "1:30", daily: "3%", max: "6%", target: "10%", mindays: "3 profitable days", time: "Unlimited", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Scaling — διπλασιασμός κεφαλαίου με milestones (έως $2M). Σφιχτό DD, 1:30." },
        funded: { lev: "1:30", daily: "3%", max: "6%", target: "—", split: "88%", payout: "Milestones (έως $2M)", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Μην ρισκάρεις το account για βιαστικό milestone." } },
      { name: "Instant", sizes: [S(5000), S(10000), S(25000), S(50000), S(100000)],
        eval: { lev: "1:30", daily: "3%", max: "6%", target: "Instant — χωρίς challenge", mindays: "—", time: "—", consistency: "20%/μέρα", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Consistency 20%/μέρα: καμία μέρα >20% του κέρδους. Leverage 1:30." },
        funded: { lev: "1:30", daily: "3%", max: "6%", target: "—", split: "88%", payout: "—", consistency: "20%/μέρα", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Σφιχτό consistency 20%/μέρα για payout." } },
    ],
  },
  {
    name: "Crypto Fund Trader",
    eurOffered: false,
    calLink: "https://www.forexfactory.com/calendar",
    calLabel: "Η CFT χρησιμοποιεί Forex Factory / crypto calendars (news επιτρέπεται)",
    summary: { models: "2-Phase, 1-Phase, Instant", sizes: "$10K–$200K (USD μόνο)", lev: "1:100 (forex/indices/metals/crypto)", daily: "5% / 4%", max: "10% / 6% (trailing 1-phase)", target: "8%→5%", news: "✓", weekend: "✓", split: "έως 90%", mindays: "5 ημ. ανά phase" },
    flags: { news: "✓ Επιτρέπεται", weekend: "✓ Επιτρέπεται", consistency: "—" },
    copy: { cross: "✗ Απαγορεύεται copy μεταξύ διαφορετικών ατόμων.", own: "✓ Επιτρέπεται copy μεταξύ των δικών σου CFT accounts.", note: "EAs/bots OK· όχι exploit/latency arbitrage." },
    alloc: { overall: "Max allocation <b>$200K</b> base ανά account (funded έως $300K)· scaling.", copyCap: "Στα δικά σου accounts ισχύει το συνολικό όριο." },
    programs: [
      { name: "2-Phase", sizes: [S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:100", daily: "5%", max: "10% (static)", target: "P1: 8% · P2: 5%", mindays: "5 ημ. ανά phase (μη συνεχόμενες)", time: "Unlimited", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "5 trading days ανά phase. Crypto volatility → static 10% πιάνεται γρήγορα." },
        funded: { lev: "1:100", daily: "5%", max: "10%", target: "—", split: "έως 90%", payout: "Εβδομαδιαία (min $100)", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Crypto gaps το Σαββατοκύριακο μπορούν να χτυπήσουν το max DD." } },
      { name: "1-Phase", sizes: [S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:100", daily: "4%", max: "6% (trailing → κλειδώνει στο αρχικό)", target: "Ανά πλάνο", mindays: "5 ημ.", time: "Unlimited", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Trailing 6% max που κλειδώνει στο αρχικό — σε ακολουθεί στο κέρδος." },
        funded: { lev: "1:100", daily: "4%", max: "6%", target: "—", split: "έως 90%", payout: "Εβδομαδιαία (min $100)", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "6% max = σφιχτό για crypto· κλείδωνε profit." } },
      { name: "Instant", sizes: [S(10000), S(25000), S(50000), S(100000), S(200000)],
        eval: { lev: "1:100", daily: "—", max: "—", target: "Instant — χωρίς challenge", mindays: "—", time: "—", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Διάβασε το ακριβές risk πλάνο ανά μέγεθος." },
        funded: { lev: "1:100", daily: "Βλ. πλάνο", max: "Βλ. πλάνο", target: "—", split: "έως 90%", payout: "Εβδομαδιαία", news: "Επιτρέπεται", weekend: "Επιτρέπεται", trap: "Οι κανόνες διαφέρουν ανά instant πλάνο." } },
    ],
  },
);

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
