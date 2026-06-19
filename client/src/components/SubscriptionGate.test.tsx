// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
void React;
import { SubscriptionGate } from "./SubscriptionGate";

// --- mocks -----------------------------------------------------------------

const navigate = vi.fn();
let currentPath = "/dashboard";
vi.mock("wouter", () => ({
  useLocation: () => [currentPath, navigate],
}));

let subState: {
  loading: boolean;
  hasAccess: boolean;
  isConfigured: boolean;
};
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => subState,
}));

beforeEach(() => {
  cleanup();
  navigate.mockClear();
  currentPath = "/dashboard";
});

describe("SubscriptionGate", () => {
  it("redirects a past_due (no-access) user to /pricing and hides children", () => {
    subState = { loading: false, hasAccess: false, isConfigured: true };
    render(
      <SubscriptionGate>
        <div>SECRET DASHBOARD</div>
      </SubscriptionGate>,
    );
    expect(navigate).toHaveBeenCalledWith("/pricing");
    expect(screen.queryByText("SECRET DASHBOARD")).toBeNull();
  });

  it("renders the app for a user with access (active/trialing)", () => {
    subState = { loading: false, hasAccess: true, isConfigured: true };
    render(
      <SubscriptionGate>
        <div>SECRET DASHBOARD</div>
      </SubscriptionGate>,
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText("SECRET DASHBOARD")).toBeTruthy();
  });

  it("fails open when Stripe is not configured (local dev)", () => {
    subState = { loading: false, hasAccess: false, isConfigured: false };
    render(
      <SubscriptionGate>
        <div>SECRET DASHBOARD</div>
      </SubscriptionGate>,
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText("SECRET DASHBOARD")).toBeTruthy();
  });

  it("does not loop-redirect when already on /pricing", () => {
    currentPath = "/pricing";
    subState = { loading: false, hasAccess: false, isConfigured: true };
    render(
      <SubscriptionGate>
        <div>SECRET DASHBOARD</div>
      </SubscriptionGate>,
    );
    expect(navigate).not.toHaveBeenCalled();
    // Still blocked: gated children never render even on the pricing path.
    expect(screen.queryByText("SECRET DASHBOARD")).toBeNull();
  });

  it("shows a splash (no children) while the status query is loading", () => {
    subState = { loading: true, hasAccess: false, isConfigured: true };
    render(
      <SubscriptionGate>
        <div>SECRET DASHBOARD</div>
      </SubscriptionGate>,
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByText("SECRET DASHBOARD")).toBeNull();
  });
});
