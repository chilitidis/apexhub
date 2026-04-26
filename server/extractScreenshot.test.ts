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

  it("uploads the screenshot and returns empty extracted (OCR now client-side)", async () => {
    const caller = makeCaller();
    const result = await caller.extractTradeFromScreenshot({
      dataUrl: "data:image/png;base64," + "A".repeat(64),
    });

    expect(result.screenshotUrl.startsWith("/manus-storage/user-1/")).toBe(true);
    expect(result.extracted).toEqual({});
    expect(invokeLLMMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid data URL", async () => {
    const caller = makeCaller();
    await expect(
      caller.extractTradeFromScreenshot({ dataUrl: "not-a-data-url-but-long-enough-to-pass-length" })
    ).rejects.toThrow(/Invalid image data URL/);
  });
});
