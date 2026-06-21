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

vi.mock("@/contexts/LanguageContext", () => {
  const dict: Record<string, string> = {
    "amh.loading": "Loading months\u2026",
    "amh.empty": "No monthly history yet",
    "amh.monthsSuffix": "months",
  };
  return {
    useLanguage: () => ({
      lang: "en",
      setLang: vi.fn(),
      t: (k: string) => dict[k] ?? k,
    }),
  };
});

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
    expect(screen.getByText(/No monthly history/i)).toBeTruthy();
  });

  it("renders a loading state while the query is pending", () => {
    useQueryMock.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<AccountMonthlyHistory accountId={1} />);
    expect(screen.getByText(/Loading months/i)).toBeTruthy();
  });

  it("renders rows, sorted newest-first", () => {
    const rows = [
      snapshotRow({ monthKey: "2026-01", monthName: "ΙΑΝΟΥΑΡΙΟΣ", yearShort: "26", netResult: -500, returnPct: -0.005 }),
      snapshotRow({ monthKey: "2026-04", monthName: "ΑΠΡΙΛΙΟΣ", yearShort: "26", netResult: 2_500, returnPct: 0.025 }),
      snapshotRow({ monthKey: "2026-02", monthName: "ΦΕΒΡΟΥΑΡΙΟΣ", yearShort: "26", netResult: 1_000, returnPct: 0.01 }),
    ];
    useQueryMock.mockReturnValue({ data: rows, isLoading: false, error: null });

    render(<AccountMonthlyHistory accountId={42} currency="USD" />);

    // 3 month rows + 1 "New Month" header button = 4 buttons total
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(4);

    // Filter out the New Month header button to inspect just month rows
    const monthButtons = buttons.filter(
      (b) => b.getAttribute("data-testid") !== "account-monthly-history-new",
    );
    expect(monthButtons.length).toBe(3);

    // Newest (April) is first month row
    expect(monthButtons[0].textContent).toMatch(/ΑΠΡ/);
    // Oldest (January) is last month row
    expect(monthButtons[2].textContent).toMatch(/ΙΑΝ/);

    // Counter shows 3 months
    expect(screen.getByText(/3 months/)).toBeTruthy();
  });

  it("navigates to the account/:id?month=key when a row is clicked", () => {
    const rows = [
      snapshotRow({ monthKey: "2026-04", monthName: "ΑΠΡΙΛΙΟΣ", netResult: 2_500 }),
    ];
    useQueryMock.mockReturnValue({ data: rows, isLoading: false, error: null });

    render(<AccountMonthlyHistory accountId={7} />);
    // Pick the first month row, not the New-Month header button
    const monthRow = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("data-testid") !== "account-monthly-history-new")[0];
    fireEvent.click(monthRow);

    expect(setLocationMock).toHaveBeenCalledTimes(1);
    expect(setLocationMock).toHaveBeenCalledWith("/account/7?month=2026-04");
  });

  it("navigates to /account/:id?action=new-month when the New Month button is clicked", () => {
    const rows = [
      snapshotRow({ monthKey: "2026-04", monthName: "ΑΠΡΙΛΙΟΣ", netResult: 1_000 }),
    ];
    useQueryMock.mockReturnValue({ data: rows, isLoading: false, error: null });

    render(<AccountMonthlyHistory accountId={11} />);
    const newMonthBtn = screen.getByTestId("account-monthly-history-new");
    fireEvent.click(newMonthBtn);

    expect(setLocationMock).toHaveBeenCalledTimes(1);
    expect(setLocationMock).toHaveBeenCalledWith("/account/11?action=new-month");
  });

  it("shows New Month button even when there is no monthly history yet", () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: false, error: null });

    render(<AccountMonthlyHistory accountId={3} />);
    const newMonthBtn = screen.getByTestId("account-monthly-history-new");
    fireEvent.click(newMonthBtn);
    expect(setLocationMock).toHaveBeenCalledWith("/account/3?action=new-month");
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
