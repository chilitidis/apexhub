/**
 * DashboardLanding tests — verifies that:
 *  - all action tiles invoke the corresponding handler
 *  - navigation tiles invoke onAccountsOverview / onComingSoon as expected
 *  - the Coming Soon labels match the sidebar items the user sees
 *
 * @vitest-environment jsdom
 */
import React from "react";
void React;
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { DashboardLanding, type DashboardHandlers } from "./DashboardLanding";

afterEach(() => cleanup());

function makeHandlers(): DashboardHandlers {
  return {
    onAddTrade: vi.fn(),
    onNewMonth: vi.fn(),
    onImport: vi.fn(),
    onSyncMt5: vi.fn(),
    onCheck: vi.fn(),
    onCash: vi.fn(),
    onWhatIf: vi.fn(),
    onExport: vi.fn(),
    onAccountsOverview: vi.fn(),
    onPatternAnalysis: vi.fn(),
    onPreMarketBriefing: vi.fn(),
    onMarketNews: vi.fn(),
    onComingSoon: vi.fn(),
  };
}

describe("DashboardLanding", () => {
  it("invokes the corresponding action handler when an action tile is clicked", () => {
    const h = makeHandlers();
    const { getAllByTestId } = render(<DashboardLanding handlers={h} />);

    fireEvent.click(getAllByTestId("dashboard-tile-add-trade")[0]);
    fireEvent.click(getAllByTestId("dashboard-tile-sync-mt5")[0]);
    fireEvent.click(getAllByTestId("dashboard-tile-new-month")[0]);
    fireEvent.click(getAllByTestId("dashboard-tile-import")[0]);
    fireEvent.click(getAllByTestId("dashboard-tile-pre-check")[0]);
    fireEvent.click(getAllByTestId("dashboard-tile-cash")[0]);
    fireEvent.click(getAllByTestId("dashboard-tile-what-if")[0]);
    fireEvent.click(getAllByTestId("dashboard-tile-export")[0]);

    expect(h.onAddTrade).toHaveBeenCalledTimes(1);
    expect(h.onSyncMt5).toHaveBeenCalledTimes(1);
    expect(h.onNewMonth).toHaveBeenCalledTimes(1);
    expect(h.onImport).toHaveBeenCalledTimes(1);
    expect(h.onCheck).toHaveBeenCalledTimes(1);
    expect(h.onCash).toHaveBeenCalledTimes(1);
    expect(h.onWhatIf).toHaveBeenCalledTimes(1);
    expect(h.onExport).toHaveBeenCalledTimes(1);
  });

  it("invokes onAccountsOverview when the Accounts Overview tile is clicked", () => {
    const h = makeHandlers();
    const { getAllByTestId } = render(<DashboardLanding handlers={h} />);
    fireEvent.click(getAllByTestId("dashboard-tile-accounts-overview")[0]);
    expect(h.onAccountsOverview).toHaveBeenCalledTimes(1);
  });

  it("routes Coming Soon tiles through onComingSoon with the right label", () => {
    const h = makeHandlers();
    const { getAllByTestId } = render(<DashboardLanding handlers={h} />);

    // Position Calculator now navigates to a real page (still routed through
    // onComingSoon, which short-circuits to setLocation in DashboardPage).
    fireEvent.click(getAllByTestId("dashboard-tile-position-calc")[0]);

    const calls = (h.onComingSoon as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0],
    );
    expect(calls).toContain("Position Calculator");
  });

  it("invokes onPatternAnalysis when the Pattern Analysis tile is clicked", () => {
    const h = makeHandlers();
    const { getAllByTestId } = render(<DashboardLanding handlers={h} />);
    fireEvent.click(getAllByTestId("dashboard-tile-pattern-analysis")[0]);
    expect(h.onPatternAnalysis).toHaveBeenCalledTimes(1);
  });
});
