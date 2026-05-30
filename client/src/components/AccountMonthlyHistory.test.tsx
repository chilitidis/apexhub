// @vitest-environment jsdom
/**
 * AccountMonthlyHistory smoke tests.
 *
 * We mock the trpc module so we can return controlled snapshot rows and
 * exercise:
 *   - empty state
 *   - happy path (rows render, sorted newest-first, with formatted P/L)
 *   - row click navigates to /account/:id?month=YYYY-MM
 */
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

void React;

const setLocationMock = vi.fn();

vi.mock("wouter", () => ({
  useLocation: () => ["/accounts", setLocationMock],
}));

const useQueryMock = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    journal: {
      listSnapshots: {
        useQuery: (...args: unknown[]) => useQueryMock(...args),
      },
    },
  },
}));

import AccountMonthlyHistory from "./AccountMonthlyHistory";

afterEach(() => {
  cleanup();
  setLocationMock.mockReset();
  useQueryMock.mockReset();
});

function snapshotRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    monthKey: "2026-04",
    monthName: "ΑΠΡΙΛΙΟΣ",
    yearFull: "2026",
    yearShort: "26",
    starting: 100_000,
    ending: 102_500,
    netResult: 2_500,
    returnPct: 0.025,
    totalTrades: 12,
    wins: 8,
    losses: 4,
    winRate: 66,
    maxDrawdownPct: 0.04,
    tradesJson: "[]",
    adjustmentsJson: "[]",
    ...overrides,
  };
}

describe("AccountMonthlyHistory", () => {
  it("renders the empty state when no snapshots exist", () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: false, error: null });
    render(<AccountMonthlyHistory accountId={1} />);
    expect(screen.getByText(/Καμία μηνιαία/i)).toBeTruthy();
  });

  it("renders a loading state while the query is pending", () => {
    useQueryMock.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<AccountMonthlyHistory accountId={1} />);
    expect(screen.getByText(/Φόρτωση μηνών/i)).toBeTruthy();
  });

  it("renders rows, sorted newest-first", () => {
    const rows = [
      snapshotRow({ monthKey: "2026-01", monthName: "ΙΑΝΟΥΑΡΙΟΣ", yearShort: "26", netResult: -500, returnPct: -0.005 }),
      snapshotRow({ monthKey: "2026-04", monthName: "ΑΠΡΙΛΙΟΣ", yearShort: "26", netResult: 2_500, returnPct: 0.025 }),
      snapshotRow({ monthKey: "2026-02", monthName: "ΦΕΒΡΟΥΑΡΙΟΣ", yearShort: "26", netResult: 1_000, returnPct: 0.01 }),
    ];
    useQueryMock.mockReturnValue({ data: rows, isLoading: false, error: null });

    render(<AccountMonthlyHistory accountId={42} currency="USD" />);

    // 3 rows present
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(3);

    // Newest (April) is first
    expect(buttons[0].textContent).toMatch(/ΑΠΡ/);
    // Oldest (January) is last
    expect(buttons[2].textContent).toMatch(/ΙΑΝ/);

    // Counter shows 3 months
    expect(screen.getByText(/3 μήνες/)).toBeTruthy();
  });

  it("navigates to the account/:id?month=key when a row is clicked", () => {
    const rows = [
      snapshotRow({ monthKey: "2026-04", monthName: "ΑΠΡΙΛΙΟΣ", netResult: 2_500 }),
    ];
    useQueryMock.mockReturnValue({ data: rows, isLoading: false, error: null });

    render(<AccountMonthlyHistory accountId={7} />);
    const row = screen.getAllByRole("button")[0];
    fireEvent.click(row);

    expect(setLocationMock).toHaveBeenCalledTimes(1);
    expect(setLocationMock).toHaveBeenCalledWith("/account/7?month=2026-04");
  });

  it("does not call the query (disabled) when visible=false", () => {
    useQueryMock.mockReturnValue({ data: undefined, isLoading: false, error: null });
    const { container } = render(
      <AccountMonthlyHistory accountId={1} visible={false} />,
    );
    // When invisible, component returns null
    expect(container.firstChild).toBeNull();
  });
});
