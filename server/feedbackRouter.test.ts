import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the DB + notification layers so the router logic can be exercised
// without a live database or upstream notification service.
const createFeedback = vi.fn();
const listAllFeedback = vi.fn();
const updateFeedbackStatus = vi.fn();
const notifyOwner = vi.fn();

vi.mock("./db", () => ({
  createFeedback: (...args: unknown[]) => createFeedback(...args),
  listAllFeedback: (...args: unknown[]) => listAllFeedback(...args),
  updateFeedbackStatus: (...args: unknown[]) => updateFeedbackStatus(...args),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: (...args: unknown[]) => notifyOwner(...args),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeCtx(role: "user" | "admin" | null): TrpcContext {
  const user: AuthenticatedUser | null = role
    ? {
        id: role === "admin" ? 1 : 2,
        openId: `sample-${role}`,
        email: `${role}@example.com`,
        name: `Sample ${role}`,
        loginMethod: "manus",
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }
    : null;
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  createFeedback.mockReset();
  listAllFeedback.mockReset();
  updateFeedbackStatus.mockReset();
  notifyOwner.mockReset();
  createFeedback.mockResolvedValue({ id: 42 });
  listAllFeedback.mockResolvedValue([]);
  updateFeedbackStatus.mockResolvedValue(undefined);
  notifyOwner.mockResolvedValue(true);
});

describe("feedback.submit", () => {
  it("requires authentication", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.feedback.submit({ category: "feature", message: "please add X" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("persists the request and returns ok with an id", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    const res = await caller.feedback.submit({
      category: "feature",
      message: "Θα ήθελα σύγκριση δύο μηνών",
    });
    expect(res).toEqual({ id: 42, ok: true });
    expect(createFeedback).toHaveBeenCalledTimes(1);
    const row = createFeedback.mock.calls[0][0];
    expect(row).toMatchObject({
      userId: 2,
      userEmail: "user@example.com",
      category: "feature",
      message: "Θα ήθελα σύγκριση δύο μηνών",
      status: "new",
    });
  });

  it("rejects messages that are too short", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(
      caller.feedback.submit({ category: "feature", message: "x" }),
    ).rejects.toBeTruthy();
    expect(createFeedback).not.toHaveBeenCalled();
  });

  it("fires an owner notification (best-effort)", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await caller.feedback.submit({ category: "bug", message: "something broke here" });
    expect(notifyOwner).toHaveBeenCalledTimes(1);
    const payload = notifyOwner.mock.calls[0][0];
    expect(payload).toHaveProperty("title");
    expect(payload).toHaveProperty("content");
  });

  it("still succeeds even when the owner notification fails", async () => {
    notifyOwner.mockRejectedValueOnce(new Error("notify down"));
    const caller = appRouter.createCaller(makeCtx("user"));
    const res = await caller.feedback.submit({
      category: "improvement",
      message: "make the charts faster please",
    });
    expect(res.ok).toBe(true);
    expect(createFeedback).toHaveBeenCalledTimes(1);
  });
});

describe("feedback admin endpoints access control", () => {
  it("blocks non-admins from listing feedback", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.feedback.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listAllFeedback).not.toHaveBeenCalled();
  });

  it("allows admins to list feedback", async () => {
    listAllFeedback.mockResolvedValueOnce([
      { id: 1, message: "hi", category: "feature", status: "new" },
    ]);
    const caller = appRouter.createCaller(makeCtx("admin"));
    const rows = await caller.feedback.list();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it("blocks non-admins from updating status", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(
      caller.feedback.updateStatus({ id: 1, status: "done" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateFeedbackStatus).not.toHaveBeenCalled();
  });

  it("lets admins update a feedback item status", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const res = await caller.feedback.updateStatus({ id: 7, status: "planned" });
    expect(res).toEqual({ ok: true });
    expect(updateFeedbackStatus).toHaveBeenCalledWith(7, "planned");
  });

  it("rejects an invalid status value", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      // @ts-expect-error intentionally invalid status
      caller.feedback.updateStatus({ id: 7, status: "bogus" }),
    ).rejects.toBeTruthy();
    expect(updateFeedbackStatus).not.toHaveBeenCalled();
  });
});
