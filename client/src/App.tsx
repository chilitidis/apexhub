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

function Router() {
  if (CLERK_ENABLED) {
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

  // Legacy / demo paths: no auth gate.
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
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
