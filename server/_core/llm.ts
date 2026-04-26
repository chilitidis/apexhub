import { recognize } from "tesseract.js";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?:
      | "audio/mpeg"
      | "audio/wav"
      | "application/pdf"
      | "audio/mp4"
      | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: { name: string };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<unknown>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

type ExtractedTrade = {
  symbol: string;
  direction: "BUY" | "SELL";
  lots: number;
  entry: number;
  close: number;
  sl: number | null;
  tp: number | null;
  pnl: number;
  swap: number;
  commission: number;
  open_time: string;
  close_time: string;
};

const KNOWN_SYMBOLS = [
  "XAUUSD",
  "XAGUSD",
  "BTCUSD",
  "ETHUSD",
  "US30",
  "NAS100",
  "SPX500",
  "GER40",
  "UK100",
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "USDCAD",
  "AUDUSD",
  "NZDUSD",
  "EURJPY",
  "GBPJPY",
  "AUDJPY",
  "CADJPY",
  "CHFJPY",
  "NZDJPY",
  "EURAUD",
  "EURGBP",
  "EURNZD",
  "EURCAD",
  "EURCHF",
  "GBPAUD",
  "GBPCAD",
  "GBPCHF",
  "GBPNZD",
  "AUDCAD",
  "AUDCHF",
  "AUDNZD",
  "NZDCAD",
  "NZDCHF",
  "CADCHF",
];

function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

function findImageDataUrl(messages: Message[]): string | undefined {
  for (const message of messages) {
    for (const part of ensureArray(message.content)) {
      if (typeof part === "string") continue;
      if (part.type === "image_url" && part.image_url?.url?.startsWith("data:image/")) {
        return part.image_url.url;
      }
    }
  }

  return undefined;
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (!match) {
    throw new Error("OCR scanner received an invalid image data URL");
  }

  return Buffer.from(match[1], "base64");
}

function normalizeText(text: string): string {
  return text
    .replace(/[|]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSymbolText(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function extractSymbol(text: string): string {
  const compact = compactSymbolText(text);

  for (const symbol of KNOWN_SYMBOLS) {
    if (compact.includes(symbol)) return symbol;
  }

  const normalized = text.toUpperCase().replace(/[\/._-]/g, "");
  const match = normalized.match(/\b([A-Z]{3})([A-Z]{3})\b/);
  if (match) return `${match[1]}${match[2]}`;

  const metal = normalized.match(/\b(XAU|XAG)\s*(USD|EUR|GBP)\b/);
  if (metal) return `${metal[1]}${metal[2]}`;

  return "";
}

function extractDirection(text: string): "BUY" | "SELL" {
  const upper = text.toUpperCase();

  if (/\bSELL\b|S\s*E\s*L\s*L/.test(upper)) return "SELL";
  if (/\bBUY\b|B\s*U\s*Y/.test(upper)) return "BUY";

  return "BUY";
}

function parseNumericToken(token: string): number | undefined {
  const cleaned = token
    .replace(/\s/g, "")
    .replace(/[$€£]/g, "")
    .replace(/,/g, ".");

  if (!/[0-9]/.test(cleaned)) return undefined;

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return undefined;

  return value;
}

function extractNumbers(text: string): Array<{ raw: string; value: number }> {
  const matches = text.match(/[+-]?\s*[$€£]?\s*\d+(?:[.,]\d+)?/g) ?? [];

  return matches
    .map((raw) => ({ raw, value: parseNumericToken(raw) }))
    .filter((item): item is { raw: string; value: number } => item.value !== undefined);
}

function numbersNear(text: string, labelPattern: RegExp): number | null {
  const match = labelPattern.exec(text);
  if (!match || match.index === undefined) return null;

  const chunk = text.slice(match.index, Math.min(text.length, match.index + 90));
  const found = extractNumbers(chunk).find((n) => Math.abs(n.value) > 0);
  return found?.value ?? null;
}

function extractTimestamps(text: string): { open_time: string; close_time: string } {
  const matches =
    text.match(
      /\b(?:20\d{2}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]20\d{2})[,\s]+(?:\d{1,2}:\d{2}(?::\d{2})?)\b/g,
    ) ?? [];

  return {
    open_time: matches[0] ?? "",
    close_time: matches[1] ?? "",
  };
}

function extractLikelyTradeLine(text: string, symbol: string, direction: "BUY" | "SELL"): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean);

  const symbolCompact = compactSymbolText(symbol);

  const scored = lines
    .map((line, index) => {
      const compact = compactSymbolText(line);
      let score = 0;

      if (symbol && compact.includes(symbolCompact)) score += 5;
      if (line.toUpperCase().includes(direction)) score += 4;
      if (/\bBUY\b|\bSELL\b/i.test(line)) score += 3;
      score += Math.min(4, extractNumbers(line).length);

      return { line, index, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 3) return text;

  const before = lines[best.index - 1] ?? "";
  const after = lines[best.index + 1] ?? "";
  return [before, best.line, after].filter(Boolean).join(" ");
}

function extractTradeFromOcrText(rawText: string): ExtractedTrade {
  const text = normalizeText(rawText);
  const symbol = extractSymbol(text);
  const direction = extractDirection(text);
  const tradeLine = extractLikelyTradeLine(rawText, symbol, direction);
  const focusedText = `${tradeLine}\n${text}`;

  const allNumbers = extractNumbers(focusedText);
  const decimalNumbers = allNumbers.filter((n) => /[.,]/.test(n.raw));

  const signedNumbers = allNumbers.filter((n) => /^[+-]/.test(n.raw.trim()));
  const pnl =
    signedNumbers.length > 0
      ? signedNumbers[signedNumbers.length - 1].value
      : numbersNear(focusedText, /\b(?:profit|p\/l|net|result|pnl)\b/i) ?? 0;

  const lots =
    numbersNear(focusedText, /\b(?:lot|lots|volume|vol)\b/i) ??
    decimalNumbers.find((n) => n.value > 0 && n.value <= 100 && !/[+-]/.test(n.raw))?.value ??
    0;

  const sl =
    numbersNear(focusedText, /\b(?:s\/l|sl|stop\s*loss)\b/i);

  const tp =
    numbersNear(focusedText, /\b(?:t\/p|tp|take\s*profit)\b/i);

  const priceCandidates = decimalNumbers
    .map((n) => n.value)
    .filter((value) => {
      if (!Number.isFinite(value)) return false;
      if (value === lots) return false;
      if (Math.abs(value) === Math.abs(pnl)) return false;
      if (value <= 0) return false;
      // Avoid percentages and tiny fees.
      if (value < 0.1) return false;
      return true;
    });

  const entry =
    numbersNear(focusedText, /\b(?:entry|open\s*price|open)\b/i) ??
    priceCandidates[0] ??
    0;

  const close =
    numbersNear(focusedText, /\b(?:exit|close\s*price|close)\b/i) ??
    priceCandidates.find((value) => value !== entry && value !== sl && value !== tp) ??
    0;

  const commission =
    numbersNear(focusedText, /\b(?:commission|comm)\b/i) ?? 0;

  const swap =
    numbersNear(focusedText, /\b(?:swap)\b/i) ?? 0;

  const { open_time, close_time } = extractTimestamps(text);

  return {
    symbol,
    direction,
    lots,
    entry,
    close,
    sl,
    tp,
    pnl,
    swap,
    commission,
    open_time,
    close_time,
  };
}

function emptyTrade(): ExtractedTrade {
  return {
    symbol: "",
    direction: "BUY",
    lots: 0,
    entry: 0,
    close: 0,
    sl: null,
    tp: null,
    pnl: 0,
    swap: 0,
    commission: 0,
    open_time: "",
    close_time: "",
  };
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const dataUrl = findImageDataUrl(params.messages);
  let extracted: ExtractedTrade = emptyTrade();

  if (dataUrl) {
    try {
      const imageBuffer = dataUrlToBuffer(dataUrl);
      const result = await recognize(imageBuffer, "eng", {
        logger: () => undefined,
      });

      extracted = extractTradeFromOcrText(result.data.text ?? "");
    } catch (err) {
      console.warn("[OCR scanner] Failed to extract screenshot text:", err);
      extracted = emptyTrade();
    }
  }

  return {
    id: `ocr-scanner-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model: "tesseract.js-local-ocr",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: JSON.stringify(extracted),
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}
