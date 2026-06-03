// SyncMt5Modal — connect a MetaTrader 5 (or 4) broker account via MetaApi.
// User enters server / login / password (read-only investor password
// recommended), saves the connection, and clicks Sync to pull all trades
// from the last 90 days into APEXHUB.
//
// Connection rows are persisted server-side with the password encrypted
// (AES-256-GCM, see server/_core/cryptoCreds.ts). Subsequent syncs reuse
// the stored credentials so the user only enters them once per broker.
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Link2, Loader2, Plug, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { Trade } from "@/lib/trading";

type Platform = "mt4" | "mt5";

interface MappedTrade {
  positionId: string;
  symbol: string;
  direction: "BUY" | "SELL";
  lots: number;
  entry: number;
  close: number;
  sl: number | null;
  tp: number | null;
  day: string;
  trade_r: number | null;
  net_pct: number;
  pnl: number;
  swap: number;
  commission: number;
  open: string;
  close_time: string;
  status: "open" | "closed";
}

interface Props {
  accountId: number;
  /** Receives mapped trades — caller decides where to merge them. */
  onTradesPulled: (payload: { trades: MappedTrade[]; since: string; until: string }) => void | Promise<void>;
  onClose: () => void;
  /**
   * When true, the modal auto-runs `handleSync` for the account's first
   * connection as soon as the connection list resolves, then closes. Used
   * by the per-account Sync button on /accounts so the user does not have
   * to click through a second confirmation step.
   */
  autoStart?: boolean;
}

function StatusBadge({ state, lastError }: { state: string; lastError: string | null }) {
  if (state === "connected") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00897B]/15 border border-[#00897B]/40 text-[#00897B] font-mono text-[9px] uppercase tracking-wider">
        <CheckCircle2 size={10} /> Connected
      </span>
    );
  }
  if (state === "connecting") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0094C6]/15 border border-[#0094C6]/40 text-[#0094C6] font-mono text-[9px] uppercase tracking-wider">
        <Loader2 size={10} className="animate-spin" /> Connecting…
      </span>
    );
  }
  if (state === "error") {
    return (
      <span
        title={lastError ?? undefined}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E94F37]/15 border border-[#E94F37]/40 text-[#E94F37] font-mono text-[9px] uppercase tracking-wider"
      >
        <AlertTriangle size={10} /> Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#4A6080] font-mono text-[9px] uppercase tracking-wider">
      <Plug size={10} /> Pending
    </span>
  );
}

export default function SyncMt5Modal({ accountId, onTradesPulled, onClose, autoStart = false }: Props) {
  const utils = trpc.useUtils();
  const list = trpc.mt5.list.useQuery();
  const upsert = trpc.mt5.upsert.useMutation({
    onSuccess: () => utils.mt5.list.invalidate(),
  });
  const remove = trpc.mt5.delete.useMutation({
    onSuccess: () => utils.mt5.list.invalidate(),
  });
  const sync = trpc.mt5.sync.useMutation({
    onSuccess: () => utils.mt5.list.invalidate(),
  });
  const [debugSample, setDebugSample] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<Platform>("mt5");
  const [server, setServer] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const connections = useMemo(
    () => (list.data ?? []).filter((c) => c.accountId === accountId),
    [list.data, accountId],
  );

  // Auto-prefill the connection name once the user enters login + server.
  useEffect(() => {
    if (!name && login && server) {
      setName(`${platform.toUpperCase()} ${login}@${server}`);
    }
  }, [login, server, platform, name]);

  const canSave = server.trim().length > 0 && login.trim().length > 0 && password.length > 0;

  async function handleSave() {
    if (!canSave) return;
    try {
      await upsert.mutateAsync({
        accountId,
        name: name.trim() || `${platform.toUpperCase()} ${login}`,
        platform,
        server: server.trim(),
        login: login.trim(),
        password,
      });
      setPassword("");
      toast.success("Connection saved");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error(msg);
    }
  }

  async function handleSync(id: number) {
    try {
      const res = await sync.mutateAsync({ id });
      toast.success(`Synced ${res.trades.length} trades from ${res.dealCount} deals`);
      await onTradesPulled({ trades: res.trades as MappedTrade[], since: res.since, until: res.until });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      toast.error(msg);
    }
  }

  // Auto-start: when the per-account Sync button mounts the modal with
  // `autoStart`, run the sync for the first available connection as soon as
  // the connections list resolves, then close the modal so the user only
  // sees the toast + the merged month opening underneath.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStart) return;
    if (autoStartedRef.current) return;
    if (list.isLoading) return;
    if (connections.length === 0) {
      toast.error("No MT5 connection set for this account");
      autoStartedRef.current = true;
      onClose();
      return;
    }
    autoStartedRef.current = true;
    const target = connections[0];
    void (async () => {
      await handleSync(target.id);
      onClose();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, list.isLoading, connections.length]);

  /**
   * Diagnostic sync — hits the same endpoint with `debug:true` and prints the
   * redacted MetaApi payload sample to console + a copy-friendly toast so the
   * user can paste it back. Trades are NOT merged into the journal here.
   */
  async function handleDebugSync(id: number) {
    try {
      const res = (await sync.mutateAsync({ id, debug: true })) as typeof sync.data & {
        debugSample?: unknown;
      };
      const sample = res.debugSample ?? { note: "No debugSample returned" };
      console.log("[MT5 debug sync]", sample);
      const txt = JSON.stringify(sample, null, 2);
      setDebugSample(txt);
      toast.success("Debug sample ready — copy it from the panel below");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Debug sync failed";
      toast.error(msg);
    }
  }

  async function copyDebugSample() {
    if (!debugSample) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(debugSample);
        toast.success("Copied");
      } else {
        toast.error("Clipboard unavailable — select + copy manually");
      }
    } catch {
      toast.error("Clipboard blocked — select + copy manually");
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Remove this MT5 connection? Trades already imported will not be touched.")) return;
    try {
      await remove.mutateAsync({ id });
      toast.success("Connection removed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      toast.error(msg);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 16, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 16, opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl bg-[#0D1E35] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0094C6]/15 border border-[#0094C6]/30 flex items-center justify-center">
                <Link2 size={15} className="text-[#0094C6]" />
              </div>
              <div>
                <div className="font-['Space_Grotesk'] font-semibold text-white text-[15px]">Σύνδεση MetaTrader</div>
                <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider mt-0.5">
                  Auto-sync trades από MT5 / MT4 μέσω MetaApi
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-[#4A6080] hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* ===== Prop-firm / funded account warning ===== */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-[#E94F37]/10 border border-[#E94F37]/35">
              <AlertTriangle size={18} className="text-[#E94F37] mt-0.5 shrink-0" />
              <div className="font-mono text-[11px] text-[#FFB4A6] leading-relaxed">
                <strong className="text-[#E94F37] uppercase tracking-wider">Σημαντικό:</strong>{" "}
                Μην συνδέεις λογαριασμούς <strong className="text-white">prop firm (funded accounts)</strong>.
                Πολλές εταιρείες απαγορεύουν εξωτερική σύνδεση/EA/bridge και υπάρχει
                κίνδυνος να θεωρηθεί παραβίαση των κανόνων (<strong className="text-white">breach</strong>)
                και να χάσεις τον funded λογαριασμό σου. Σύνδεσε μόνο{" "}
                <strong className="text-white">personal / live / demo</strong> λογαριασμούς.
              </div>
            </div>

            {/* ===== Existing connections ===== */}
            {connections.length > 0 && (
              <section>
                <div className="font-mono text-[9px] uppercase tracking-widest text-[#4A6080] mb-2">
                  Αποθηκευμένες συνδέσεις
                </div>
                <div className="space-y-2">
                  {connections.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-[#0A1628] border border-white/5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-['Space_Grotesk'] font-semibold text-white text-sm truncate">
                            {c.name || `${c.platform.toUpperCase()} ${c.login}`}
                          </span>
                          <StatusBadge state={c.state} lastError={c.lastError ?? null} />
                        </div>
                        <div className="font-mono text-[10px] text-[#4A6080] mt-0.5 truncate">
                          {c.platform.toUpperCase()} · {c.server} · login {c.login}
                          {c.lastSyncedAt && (
                            <> · last sync {new Date(c.lastSyncedAt).toLocaleString()}</>
                          )}
                        </div>
                        {c.state === "error" && c.lastError && (
                          <div className="font-mono text-[10px] text-[#E94F37]/80 mt-1 line-clamp-2">
                            {c.lastError}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleSync(c.id)}
                          disabled={sync.isPending}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#0094C6]/15 hover:bg-[#0094C6]/25 border border-[#0094C6]/40 text-[#0094C6] hover:text-white font-mono text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50"
                          title="Sync trades from this MT5 account"
                        >
                          {sync.isPending && sync.variables?.id === c.id && !sync.variables?.debug ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <RefreshCw size={11} />
                          )}
                          Sync
                        </button>
                        <button
                          onClick={() => handleDebugSync(c.id)}
                          disabled={sync.isPending}
                          className="px-2 py-1.5 rounded-md bg-[#F4A261]/15 hover:bg-[#F4A261]/25 border border-[#F4A261]/40 text-[#F4A261] hover:text-white font-mono text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50"
                          title="Diagnostic sync — returns redacted MetaApi sample for SL/TP debugging (no merge)"
                        >
                          {sync.isPending && sync.variables?.id === c.id && sync.variables?.debug ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            "Debug"
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={remove.isPending}
                          className="px-2 py-1.5 rounded-md text-[#4A6080] hover:text-[#E94F37] hover:bg-[#E94F37]/10 transition-colors"
                          title="Remove connection"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ===== Debug sample panel ===== */}
            {debugSample && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#F4A261]">
                    MetaApi debug sample
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyDebugSample}
                      className="px-2 py-1 rounded-md bg-[#F4A261]/15 hover:bg-[#F4A261]/25 border border-[#F4A261]/40 text-[#F4A261] hover:text-white font-mono text-[10px] uppercase tracking-wider transition-colors"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => setDebugSample(null)
                      }
                      className="px-2 py-1 rounded-md text-[#4A6080] hover:text-white font-mono text-[10px] uppercase tracking-wider transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={debugSample}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  className="w-full h-56 bg-[#0A1628] border border-[#F4A261]/30 rounded-md px-3 py-2 font-mono text-[11px] text-white/85 leading-relaxed resize-none"
                />
                <div className="font-mono text-[9px] text-[#4A6080] mt-1.5">
                  Επικόλλησέ το στο chat — με αυτό βρίσκω ποιο πεδίο κρατάει το SL για τον broker σου.
                </div>
              </section>
            )}

            {/* ===== Add connection form ===== */}
            <section>
              <div className="font-mono text-[9px] uppercase tracking-widest text-[#4A6080] mb-2">
                {connections.length > 0 ? "Προσθήκη / ενημέρωση" : "Νέα σύνδεση"}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 col-span-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#4A6080]">Πλατφόρμα</span>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as Platform)}
                    className="bg-[#0A1628] border border-white/10 rounded-md px-2.5 py-2 text-sm text-white focus:border-[#0094C6] outline-none"
                  >
                    <option value="mt5">MetaTrader 5</option>
                    <option value="mt4">MetaTrader 4</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 col-span-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#4A6080]">Όνομα (προαιρετικό)</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="FTMO Challenge $100k"
                    className="bg-[#0A1628] border border-white/10 rounded-md px-2.5 py-2 text-sm text-white focus:border-[#0094C6] outline-none placeholder-[#4A6080]"
                  />
                </label>
                <label className="flex flex-col gap-1.5 col-span-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#4A6080]">Server (broker)</span>
                  <input
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    placeholder="ICMarkets-Live02"
                    className="bg-[#0A1628] border border-white/10 rounded-md px-2.5 py-2 text-sm text-white focus:border-[#0094C6] outline-none placeholder-[#4A6080]"
                  />
                  <span className="font-mono text-[9px] text-[#4A6080]">
                    Το βλέπεις στο MT5 → File → Login to Trade Account → Server
                  </span>
                </label>
                <label className="flex flex-col gap-1.5 col-span-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#4A6080]">Login</span>
                  <input
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="123456"
                    className="bg-[#0A1628] border border-white/10 rounded-md px-2.5 py-2 text-sm text-white focus:border-[#0094C6] outline-none placeholder-[#4A6080]"
                  />
                </label>
                <label className="flex flex-col gap-1.5 col-span-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#4A6080]">
                    Investor (read-only) password
                  </span>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="off"
                      className="w-full bg-[#0A1628] border border-white/10 rounded-md px-2.5 py-2 pr-9 text-sm text-white focus:border-[#0094C6] outline-none placeholder-[#4A6080]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4A6080] hover:text-white"
                      tabIndex={-1}
                    >
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </label>
              </div>

              <div className="mt-3 px-3 py-2 rounded-md bg-[#F4A261]/10 border border-[#F4A261]/30">
                <div className="font-mono text-[10px] text-[#F4A261] leading-relaxed">
                  <strong>Tip:</strong> Στο MT5 πήγαινε στο Tools → Options → Server και αντίγραψε το όνομα του server. Χρησιμοποίησε τον <em>investor password</em> (read-only) — όχι τον master password — για μέγιστη ασφάλεια. Δεν μπορούμε να κάνουμε καμία συναλλαγή με investor password, μόνο να δούμε τα trades.
                </div>
              </div>
            </section>
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/5 bg-[#0A1628]">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-md border border-white/10 text-white/70 hover:text-white font-mono text-[10px] uppercase tracking-wider transition-colors"
            >
              Κλείσιμο
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave || upsert.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-mono text-[10px] uppercase tracking-wider shadow-lg shadow-[#0094C6]/20 transition-all"
            >
              {upsert.isPending ? <Loader2 size={11} className="animate-spin" /> : <Plug size={11} />}
              {connections.some((c) => c.server === server.trim() && c.login === login.trim())
                ? "Update credentials"
                : "Save connection"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
