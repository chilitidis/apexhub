/**
 * telegram.ts — Team Signals ingestion from the owner's private Telegram
 * channel.
 *
 * Flow: the owner posts a signal in his channel → Telegram calls our webhook
 * (registered at boot via setWebhook) → we authenticate the request with the
 * shared secret header → parseSignal() → row in the `signals` table. Members
 * then see the signal in the Position Calculator with their own lot size.
 * Nothing is ever executed and nothing is public.
 *
 * Registered alongside the Stripe webhook (before the tRPC middleware); a
 * plain JSON body is fine here — Telegram authenticates via the
 * `x-telegram-bot-api-secret-token` header, not a body signature.
 */
import type { Express, Request, Response } from "express";
import express from "express";
import { ENV } from "./_core/env";
import {
  closeLatestActiveSignalBySymbol,
  upsertSignalByTelegramId,
} from "./db";
import { isCloseAction, isParseError, parseSignal } from "./signalParser";

interface TelegramChat {
  id: number | string;
}

interface TelegramMessage {
  message_id: number;
  chat?: TelegramChat;
  text?: string;
  caption?: string;
}

interface TelegramUpdate {
  update_id?: number;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  message?: TelegramMessage;
}

/** decimal columns want strings; keep full precision without float notation. */
function dec(n: number | null): string | null {
  if (n === null || !Number.isFinite(n)) return null;
  return n.toFixed(6);
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const msg = update.channel_post ?? update.edited_channel_post ?? update.message;
  if (!msg) return;

  const chatId = msg.chat?.id;
  if (chatId === undefined || chatId === null) return;
  if (ENV.telegramChannelId && String(chatId) !== ENV.telegramChannelId) {
    // Someone added the bot to another chat — ignore silently.
    return;
  }

  const text = msg.text ?? msg.caption;
  if (!text) return;

  const parsed = parseSignal(text);
  if (isParseError(parsed)) {
    // Not every channel post is a signal (chatter, updates...). Log + move on.
    console.log(`[Telegram] Ignored message ${chatId}:${msg.message_id}: ${parsed.error}`);
    return;
  }

  if (isCloseAction(parsed)) {
    const closed = await closeLatestActiveSignalBySymbol(parsed.symbol);
    console.log(
      `[Telegram] Close request for ${parsed.symbol}: ${closed ? "closed latest active signal" : "no active signal found"}`,
    );
    return;
  }

  const telegramMsgId = `${chatId}:${msg.message_id}`;
  await upsertSignalByTelegramId({
    telegramMsgId,
    symbol: parsed.symbol,
    direction: parsed.direction,
    entryType: parsed.entryType,
    entry: dec(parsed.entry),
    sl: dec(parsed.sl)!,
    tp1: dec(parsed.tp1),
    tp2: dec(parsed.tp2),
    tp3: dec(parsed.tp3),
    rawText: text,
  });
  if (parsed.warnings.length > 0) {
    console.warn(`[Telegram] Signal ${telegramMsgId} warnings:`, parsed.warnings.join("; "));
  }
  console.log(
    `[Telegram] Ingested signal ${telegramMsgId}: ${parsed.direction} ${parsed.symbol} SL ${parsed.sl}`,
  );
}

export function registerTelegramWebhook(app: Express) {
  app.post(
    "/api/telegram/webhook",
    express.json({ limit: "1mb" }),
    async (req: Request, res: Response) => {
      // Authenticate with the shared secret Telegram echoes back on every
      // call. 404 (not 401/403) on mismatch so the endpoint is invisible to
      // probes; also refuse everything when the secret is not configured.
      const secret = req.headers["x-telegram-bot-api-secret-token"];
      if (!ENV.telegramWebhookSecret || secret !== ENV.telegramWebhookSecret) {
        return res.status(404).send("Not found");
      }

      try {
        await handleTelegramUpdate((req.body ?? {}) as TelegramUpdate);
      } catch (err) {
        // NEVER 500 to Telegram — it would retry the same update forever.
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[Telegram] Webhook handler error:", msg);
      }
      return res.json({ ok: true });
    },
  );
}

/**
 * Called once at server boot: point the bot's webhook at this deployment.
 * Best-effort — a failure is logged and never crashes the boot.
 */
export async function setupTelegramWebhook(): Promise<void> {
  if (!ENV.telegramBotToken || !ENV.telegramWebhookSecret) {
    console.log("[Telegram] Bot token / webhook secret not set — signal ingestion disabled.");
    return;
  }
  try {
    const url = `${ENV.publicUrl.replace(/\/+$/, "")}/api/telegram/webhook`;
    const res = await fetch(
      `https://api.telegram.org/bot${ENV.telegramBotToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          secret_token: ENV.telegramWebhookSecret,
          allowed_updates: ["channel_post", "edited_channel_post", "message"],
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const body = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (res.ok && body?.ok) {
      console.log(`[Telegram] setWebhook ok → ${url}`);
    } else {
      console.warn(`[Telegram] setWebhook failed (HTTP ${res.status}):`, body?.description ?? "unknown error");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[Telegram] setWebhook failed:", msg);
  }
}
