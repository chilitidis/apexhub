// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
void React;

// Clerk auth buttons render their children directly in tests.
vi.mock("@clerk/clerk-react", () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignUpButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// IntersectionObserver is not available in jsdom.
beforeEach(() => {
  cleanup();
  localStorage.clear();
  // @ts-expect-error - minimal stub
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

import Landing from "./Landing";
import { LanguageProvider } from "@/contexts/LanguageContext";

function renderLanding() {
  return render(
    <LanguageProvider>
      <Landing />
    </LanguageProvider>,
  );
}

describe("Landing page (English default)", () => {
  it("renders the English hero headline by default", () => {
    renderLanding();
    expect(screen.getAllByText(/Journal every trade/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Master/i).length).toBeGreaterThan(0);
  });

  it("shows the AI coach section with both coaches", () => {
    renderLanding();
    expect(screen.getAllByText(/Trading Coach/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Mindset Coach/i).length).toBeGreaterThan(0);
  });

  it("renders the real Stripe pricing (monthly, semiannual, annual)", () => {
    renderLanding();
    expect(screen.getByText("€39.99")).toBeTruthy();
    expect(screen.getByText("€199.99")).toBeTruthy();
    expect(screen.getByText("€399.99")).toBeTruthy();
  });

  it("renders free-month badges and 7-day trial copy in English", () => {
    renderLanding();
    expect(screen.getByText("1 month free")).toBeTruthy();
    expect(screen.getByText("2 months free")).toBeTruthy();
    expect(screen.getAllByText(/7-day free trial/i).length).toBeGreaterThan(0);
  });

  it("renders the English FAQ section", () => {
    renderLanding();
    expect(screen.getByText(/How does the AI Trading Coach work/i)).toBeTruthy();
    expect(screen.getByText(/Is this investment advice/i)).toBeTruthy();
  });
});

describe("Landing page (Greek toggle)", () => {
  it("switches to Greek copy when the EL toggle is clicked", () => {
    renderLanding();
    // The toggle exposes two buttons labelled EN / EL.
    const elButtons = screen.getAllByText("EL");
    fireEvent.click(elButtons[0]);
    expect(screen.getAllByText(/Κατέγραψε κάθε trade/i).length).toBeGreaterThan(0);
    expect(screen.getByText("1 μήνας δωρεάν")).toBeTruthy();
  });
});
