// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
void React;
import { SubscriptionStatusCard } from "./SubscriptionStatusCard";

// --- mocks -----------------------------------------------------------------

const navigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/", navigate],
}));

const portalMutate = vi.fn();
vi.mock("@/lib/trpc", () => ({
  trpc: {
    subscription: {
      createPortal: {
        useMutation: () => ({ mutate: portalMutate, isPending: false }),
      },
    },
  },
}));

let subState: {
  status: string;
  isTrialing: boolean;
  trialDaysLeft: number | null;
  isConfigured: boolean;
  loading: boolean;
};
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => subState,
}));

beforeEach(() => {
  cleanup();
  navigate.mockClear();
  portalMutate.mockClear();
});

describe("SubscriptionStatusCard", () => {
  it("hides entirely when Stripe is not configured", () => {
    subState = {
      status: "none",
      isTrialing: false,
      trialDaysLeft: null,
      isConfigured: false,
      loading: false,
    };
    const { container } = render(<SubscriptionStatusCard />);
    expect(container.firstChild).toBeNull();
  });

  it("shows an upsell that opens /pricing when the user has no plan", () => {
    subState = {
      status: "none",
      isTrialing: false,
      trialDaysLeft: null,
      isConfigured: true,
      loading: false,
    };
    render(<SubscriptionStatusCard />);
    const btn = screen.getByText(/Επίλεξε πλάνο/);
    fireEvent.click(btn);
    expect(navigate).toHaveBeenCalledWith("/pricing");
    expect(portalMutate).not.toHaveBeenCalled();
  });

  it("opens the Stripe portal when the user is active", () => {
    subState = {
      status: "active",
      isTrialing: false,
      trialDaysLeft: null,
      isConfigured: true,
      loading: false,
    };
    render(<SubscriptionStatusCard />);
    fireEvent.click(screen.getByText(/Διαχείριση/));
    expect(portalMutate).toHaveBeenCalledTimes(1);
  });

  it("shows trial days left and a view-plans link while trialing", () => {
    subState = {
      status: "trialing",
      isTrialing: true,
      trialDaysLeft: 5,
      isConfigured: true,
      loading: false,
    };
    render(<SubscriptionStatusCard />);
    expect(screen.getByText(/5 days left/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/Δες πλάνα/));
    expect(navigate).toHaveBeenCalledWith("/pricing");
  });
});
