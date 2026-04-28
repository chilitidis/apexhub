import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { CLERK_ENABLED } from "./const";
import { ThemeProvider } from "./contexts/ThemeContext";
import Accounts from "./pages/Accounts";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import ShareView from "./pages/ShareView";

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
        <Switch>
          <Route path={"/"} component={Accounts} />
          <Route path={"/account/:id"} component={Home} />
          <Route path={"/404"} component={NotFound} />
          <Route component={NotFound} />
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
