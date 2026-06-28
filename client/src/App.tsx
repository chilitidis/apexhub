import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { CLERK_ENABLED } from "./const";
import { ThemeProvider } from "./contexts/ThemeContext";
import Accounts from "./pages/Accounts";
import CalendarPage from "./pages/CalendarPage";
import DashboardPage from "./pages/DashboardPage";
import PositionCalculator from "./pages/PositionCalculator";
import TradingCoachPage from "./pages/TradingCoachPage";
import PropFirmTrackerPage from "./pages/PropFirmTrackerPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import ShareView from "./pages/ShareView";
import Paywall from "./pages/Paywall";
import { SubscriptionGate } from "./components/SubscriptionGate";

/**
 * Public share pages live at `/s/:token` and must be reachable even when the
 * user is not authenticated. Everything else sits behind the Clerk auth gate
 * (when Clerk is enabled) or is a legacy demo path (when it's not).
 */
function Router() {
  return (
    <Switch>
      <Route path={"/s/:token"} component={ShareView} />
      <Route>{() => (CLERK_ENABLED ? <AuthedRouter /> : <LegacyRouter />)}</Route>
    </Switch>
  );
}

function AuthedRouter() {
  return (
    <>
      {/* Signed-in users land on the account picker. From there they pick an
          account (or create a new one) and are routed to /account/:id for
          the full journal dashboard. */}
      <SignedIn>
        {/* The pricing/paywall page must stay reachable even without access so
            users can start a trial; everything else sits behind the gate. */}
        <Switch>
          <Route path={"/pricing"} component={Paywall} />
          <Route>
            {() => (
              <SubscriptionGate>
                <Switch>
                  <Route path={"/"} component={DashboardPage} />
                  <Route path={"/dashboard"} component={DashboardPage} />
                  <Route path={"/accounts"} component={Accounts} />
                  <Route path={"/calendar"} component={CalendarPage} />
                  <Route path={"/position-calculator"} component={PositionCalculator} />
                  <Route path={"/trading-coach"} component={TradingCoachPage} />
                  <Route path={"/prop-firm-tracker"} component={PropFirmTrackerPage} />
                  <Route path={"/admin"} component={AdminUsersPage} />
                  <Route path={"/account/:id"} component={Home} />
                  <Route path={"/404"} component={NotFound} />
                  <Route component={NotFound} />
                </Switch>
              </SubscriptionGate>
            )}
          </Route>
        </Switch>
      </SignedIn>
      <SignedOut>
        <Landing />
      </SignedOut>
    </>
  );
}

function LegacyRouter() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"} component={Home} />
      <Route path={"/accounts"} component={Home} />
      <Route path={"/account/:id"} component={Home} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
