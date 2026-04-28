import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock storage + LLM before importing the router so the procedure uses our stubs.
vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key, url: `/manus-storage/${key}` })),
}));

const invokeLLMMock = vi.fn();
vi.mock("./_core/llm", () => ({
  invokeLLM: (...args: unknown[]) => invokeLLMMock(...args),
}));

// db helpers are not used by this procedure, but journalRouter imports them.
vi.mock("./db", () => ({
  deleteActiveTrade: vi.fn(),
  deleteMonthlySnapshot: vi.fn(),
  deleteTrade: vi.fn(),
  deleteTradesForMonth: vi.fn(),
  getActiveTrade: vi.fn(),
  listAllTrades: vi.fn(),
  listMonthlySnapshots: vi.fn(),
  listTradesForMonth: vi.fn(),
  replaceTradesForMonth: vi.fn(),
  upsertActiveTrade: vi.fn(),
  upsertMonthlySnapshot: vi.fn(),
  upsertTrade: vi.fn(),
}));

import { journalRouter } from "./journalRouter";

const makeCaller = () =>
  journalRouter.createCaller({
    user: { id: "user-1", name: "Test", role: "user" } as never,
  } as never);

describe("journal.extractTradeFromScreenshot", () => {
  beforeEach(() => {
    invokeLLMMock.mockReset();
  });

  it("calls the LLM with the data URL and returns the extracted fields", async () => {
    invokeLLMMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              symbol: "EURUSD",
              direction: "BUY",
              lots: 0.5,
              entry: 1.0852,
              close: 1.0873,
              sl: null,
              tp: null,
              pnl: 105,
              swap: 0,
              commission: 0,
              open_time: "2026-04-27T09:30:00Z",
              close_time: "2026-04-27T10:45:00Z",
            }),
          },
        },
      ],
    });

    const caller = makeCaller();
    const result = await caller.extractTradeFromScreenshot({
      dataUrl: "data:image/png;base64," + "A".repeat(64),
    });

    expect(result.screenshotUrl.startsWith("/manus-storage/user-1/")).toBe(true);
    expect(result.extracted).toMatchObject({
      symbol: "EURUSD",
      direction: "BUY",
      lots: 0.5,
      entry: 1.0852,
      pnl: 105,
    });
    expect(invokeLLMMock).toHaveBeenCalledTimes(1);

    // Ensure the image was actually forwarded to the LLM as a vision input.
    const args = invokeLLMMock.mock.calls[0][0] as {
      messages: Array<{ role: string; content: unknown }>;
    };
    const userTurn = args.messages.find((m) => m.role === "user");
    expect(userTurn).toBeDefined();
    expect(Array.isArray(userTurn!.content)).toBe(true);
    const parts = userTurn!.content as Array<{ type: string; image_url?: { url: string } }>;
    const imagePart = parts.find((p) => p.type === "image_url");
    expect(imagePart?.image_url?.url).toMatch(/^data:image\/png;base64,/);
  });

  it("rejects an invalid data URL", async () => {
    const caller = makeCaller();
    await expect(
      caller.extractTradeFromScreenshot({
        dataUrl: "not-a-data-url-but-long-enough-to-pass-length",
      }),
    ).rejects.toThrow(/Invalid image data URL/);
  });

  it("surfaces a clear error when the LLM returns an empty response", async () => {
    invokeLLMMock.mockResolvedValueOnce({
      choices: [{ message: { content: "" } }],
    });
    const caller = makeCaller();
    await expect(
      caller.extractTradeFromScreenshot({
        dataUrl: "data:image/png;base64," + "A".repeat(64),
      }),
    ).rejects.toThrow(/did not get a response/i);
  });

  it("surfaces a clear error when the LLM returns unparseable output", async () => {
    invokeLLMMock.mockResolvedValueOnce({
      choices: [{ message: { content: "not json at all" } }],
    });
    const caller = makeCaller();
    await expect(
      caller.extractTradeFromScreenshot({
        dataUrl: "data:image/png;base64," + "A".repeat(64),
      }),
    ).rejects.toThrow(/could not parse/i);
  });

  it("accepts JPEG screenshots", async () => {
    invokeLLMMock.mockResolvedValueOnce({
      choices: [{ message: { content: '{"symbol":"XAUUSD","direction":"SELL","lots":0.1,"entry":2300,"close":2305,"sl":null,"tp":null,"pnl":-50,"swap":0,"commission":0,"open_time":"","close_time":""}' } }],
    });
    const caller = makeCaller();
    const result = await caller.extractTradeFromScreenshot({
      dataUrl: "data:image/jpeg;base64," + "A".repeat(64),
    });
    expect(result.screenshotUrl).toMatch(/^\/manus-storage\/user-1\//);
    expect((result.extracted as { symbol: string }).symbol).toBe("XAUUSD");
  });

  it("forwards the image to the LLM with high detail", async () => {
    invokeLLMMock.mockResolvedValueOnce({
      choices: [{ message: { content: '{"symbol":"X","direction":"BUY","lots":0,"entry":0,"close":0,"sl":null,"tp":null,"pnl":0,"swap":0,"commission":0,"open_time":"","close_time":""}' } }],
    });
    const caller = makeCaller();
    await caller.extractTradeFromScreenshot({
      dataUrl: "data:image/png;base64," + "A".repeat(64),
    });
    const args = invokeLLMMock.mock.calls[0][0] as {
      messages: Array<{ role: string; content: unknown }>;
    };
    const userTurn = args.messages.find((m) => m.role === "user")!;
    const parts = userTurn.content as Array<{ type: string; image_url?: { detail?: string } }>;
    const imagePart = parts.find((p) => p.type === "image_url");
    expect(imagePart?.image_url?.detail).toBe("high");
  });
});
