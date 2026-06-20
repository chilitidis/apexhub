// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
void React;

// Clerk auth buttons render their children directly in tests.
vi.mock("@clerk/clerk-react", () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignUpButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// IntersectionObserver is not available in jsdom.
beforeEach(() => {
  cleanup();
  // @ts-expect-error - minimal stub
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

import Landing from "./Landing";

describe("Landing page", () => {
  it("renders the hero headline", () => {
    render(<Landing />);
    expect(screen.getAllByText(/Κατέκτησε|Κατάκτησε/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Κατέγραψε κάθε trade/i).length).toBeGreaterThan(0);
  });

  it("shows the AI coach section with both coaches", () => {
    render(<Landing />);
    expect(screen.getAllByText(/Trading Coach/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Mindset Coach/i).length).toBeGreaterThan(0);
  });

  it("renders the real Stripe pricing (monthly, semiannual, annual)", () => {
    render(<Landing />);
    expect(screen.getByText("€39.99")).toBeTruthy();
    expect(screen.getByText("€199.99")).toBeTruthy();
    expect(screen.getByText("€399.99")).toBeTruthy();
  });

  it("renders free-month badges and 7-day trial copy", () => {
    render(<Landing />);
    expect(screen.getByText("1 μήνας δωρεάν")).toBeTruthy();
    expect(screen.getByText("2 μήνες δωρεάν")).toBeTruthy();
    expect(screen.getAllByText(/7 ημέρες δωρεάν/i).length).toBeGreaterThan(0);
  });

  it("renders the FAQ section", () => {
    render(<Landing />);
    expect(screen.getByText(/Πώς δουλεύει ο AI Trading Coach/i)).toBeTruthy();
    expect(screen.getByText(/Είναι επενδυτική συμβουλή/i)).toBeTruthy();
  });
});
