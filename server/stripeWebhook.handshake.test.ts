import { describe, expect, it, vi } from "vitest";
import express from "express";
import { registerStripeWebhook } from "./stripeWebhook";

// We only need a Stripe object that exists; the handshake path must short-circuit
// BEFORE any Stripe call, so constructEvent should never run for test probes.
const constructEvent = vi.fn(() => {
  throw new Error("constructEvent should NOT be called for test-probe events");
});

vi.mock("./_core/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent },
    subscriptions: { retrieve: vi.fn() },
    customers: { retrieve: vi.fn() },
  }),
  isStripeConfigured: () => true,
}));

vi.mock("./subscriptionDb", () => ({
  upsertSubscription: vi.fn(),
  getSubscriptionByCustomer: vi.fn(),
  getSubscriptionByUser: vi.fn(),
}));

/** Tiny helper: boot the express app on an ephemeral port and POST to it. */
async function postWebhook(body: string) {
  const app = express();
  registerStripeWebhook(app);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address() as { port: number };
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": "t=0,v1=fake" },
      body,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  } finally {
    server.close();
  }
}

describe("Stripe webhook test-event handshake", () => {
  it("returns { verified: true } for evt_test_* without verifying the signature", async () => {
    const { status, json } = await postWebhook(
      JSON.stringify({ id: "evt_test_abc", type: "customer.subscription.updated", data: { object: {} } }),
    );
    expect(status).toBe(200);
    expect(json).toEqual({ verified: true });
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it("attempts signature verification (and fails with 400) for real-looking events", async () => {
    const { status } = await postWebhook(
      JSON.stringify({ id: "evt_live_real", type: "customer.subscription.updated", data: { object: {} } }),
    );
    expect(status).toBe(400);
    expect(constructEvent).toHaveBeenCalledTimes(1);
  });
});
