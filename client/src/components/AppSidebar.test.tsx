// @vitest-environment jsdom
/**
 * AppSidebar smoke tests — verify that the flat sidebar:
 *  - renders no section headers (Round 29 flattened the nav)
 *  - renders every action item wired to handlers (Add Trade, Connect MT5, etc.)
 *  - has no Live Sync entry (moved to the Accounts page in Round 29)
 *  - fires the matching handler when the corresponding item is clicked
 *  - flips view via setView when a "view" item is clicked
 *
 * We mount the component inside a minimal QueryClient + tRPC provider stub to
 * satisfy useAuth(). useAuth hits trpc.auth.me which would fail without a
 * provider; we mock the module instead to keep this a unit-level test.
 */
import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Silence unused-React warning under classic runtime; tsx tests run through
// esbuild and need the explicit import for JSX.
void React;
import { AppSidebar, type SidebarHandlers, type ViewKey } from "./AppSidebar";

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Tester", email: "t@example.com" },
    loading: false,
    error: null,
    isAuthenticated: true,
    logout: () => {},
  }),
}));

vi.mock("@/components/ThemeToggle", () => ({
  default: () => <div data-testid="theme-toggle-stub" />,
}));

// SubscriptionStatusCard relies on trpc + a provider; stub it out so the
// sidebar stays a pure unit test.
vi.mock("@/components/SubscriptionStatusCard", () => ({
  SubscriptionStatusCard: () => <div data-testid="subscription-status-stub" />,
}));

vi.mock("@/const", () => ({
  CLERK_ENABLED: false,
  getLoginUrl: () => "/login",
}));

vi.mock("@clerk/clerk-react", () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton: () => <div data-testid="user-button-stub" />,
}));

function makeHandlers(): SidebarHandlers {
  return {
    onAddTrade: vi.fn(),
    onNewMonth: vi.fn(),
    onImport: vi.fn(),
    onSyncMt5: vi.fn(),
    onCheck: vi.fn(),
    onCash: vi.fn(),
    onCalc: vi.fn(),
    onExport: vi.fn(),
  };
}

describe("AppSidebar", () => {
  afterEach(() => cleanup());
  it("renders no section headers (flat list)", () => {
    const handlers = makeHandlers();
    const setView = vi.fn();
    render(
      <AppSidebar
        view={"dashboard" as ViewKey}
        setView={setView}
        handlers={handlers}
      />
    );

    expect(screen.queryByText("MAIN")).toBeNull();
    expect(screen.queryByText("ACCOUNTS")).toBeNull();
    expect(screen.queryByText("TOOLS")).toBeNull();
    expect(screen.queryByText("ANALYTICS")).toBeNull();
    expect(screen.queryByText("AI TOOLS")).toBeNull();
  });

  it("does not render the Live Sync entry (moved to /accounts)", () => {
    const handlers = makeHandlers();
    const setView = vi.fn();
    render(
      <AppSidebar
        view={"dashboard" as ViewKey}
        setView={setView}
        handlers={handlers}
      />
    );
    expect(screen.queryByTestId("sidebar-item-live-sync")).toBeNull();
    expect(screen.queryByText("Live Sync")).toBeNull();
  });

  it("fires handlers when action items are clicked", () => {
    const handlers = makeHandlers();
    const setView = vi.fn();
    render(
      <AppSidebar
        view={"dashboard" as ViewKey}
        setView={setView}
        handlers={handlers}
      />
    );

const click = (id: string) =>
      fireEvent.click(screen.getAllByTestId(id)[0]);

    click("sidebar-item-add-trade");
    expect(handlers.onAddTrade).toHaveBeenCalledOnce();

    click("sidebar-item-sync-mt5");
    expect(handlers.onSyncMt5).toHaveBeenCalledOnce();

    click("sidebar-item-import");
    expect(handlers.onImport).toHaveBeenCalledOnce();

    click("sidebar-item-cash");
    expect(handlers.onCash).toHaveBeenCalledOnce();

    click("sidebar-item-export");
    expect(handlers.onExport).toHaveBeenCalledOnce();
  });

  it("calls setView with the matching view key when a view item is clicked", () => {
    const handlers = makeHandlers();
    const setView = vi.fn();
    render(
      <AppSidebar
        view={"dashboard" as ViewKey}
        setView={setView}
        handlers={handlers}
      />
    );

    const click = (id: string) =>
      fireEvent.click(screen.getAllByTestId(id)[0]);

    click("sidebar-item-accounts");
    expect(setView).toHaveBeenCalledWith("accounts");

    click("sidebar-item-analytics");
    expect(setView).toHaveBeenCalledWith("analytics");

    click("sidebar-item-calendar");
    expect(setView).toHaveBeenCalledWith("calendar");
  });

  it("does not fire any handler when only setView is needed (view items don't trigger actions)", () => {
    const handlers = makeHandlers();
    const setView = vi.fn();
    render(
      <AppSidebar
        view={"dashboard" as ViewKey}
        setView={setView}
        handlers={handlers}
      />
    );

    fireEvent.click(screen.getAllByTestId("sidebar-item-position-calc")[0]);

    expect(handlers.onAddTrade).not.toHaveBeenCalled();
    expect(handlers.onSyncMt5).not.toHaveBeenCalled();
    expect(handlers.onCash).not.toHaveBeenCalled();
    expect(setView).toHaveBeenCalledWith("position-calc");
  });
});
