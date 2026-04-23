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
  getActiveTrade: vi.fn(),
  listMonthlySnapshots: vi.fn(),
  upsertActiveTrade: vi.fn(),
  upsertMonthlySnapshot: vi.fn(),
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

  it("uploads the screenshot and returns the parsed trade fields", async () => {
    invokeLLMMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              symbol: "EURUSD",
              direction: "BUY",
              lots: 0.1,
              entry: 1.085,
              close: 1.09,
              sl: 1.08,
              tp: 1.1,
              pnl: 45.5,
              swap: 0,
              commission: 0,
              open_time: "",
              close_time: "",
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
      pnl: 45.5,
    });
    expect(invokeLLMMock).toHaveBeenCalledOnce();
  });

  it("rejects an invalid data URL", async () => {
    const caller = makeCaller();
    await expect(
      caller.extractTradeFromScreenshot({ dataUrl: "not-a-data-url-but-long-enough-to-pass-length" })
    ).rejects.toThrow(/Invalid image data URL/);
    expect(invokeLLMMock).not.toHaveBeenCalled();
  });

  it("throws when the LLM returns unparsable content", async () => {
    invokeLLMMock.mockResolvedValueOnce({
      choices: [{ message: { content: "not json" } }],
    });
    const caller = makeCaller();
    await expect(
      caller.extractTradeFromScreenshot({
        dataUrl: "data:image/jpeg;base64," + "B".repeat(64),
      })
    ).rejects.toThrow(/invalid JSON/i);
  });
});
