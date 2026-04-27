import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { CLERK_ENABLED } from "./const";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Landing from "./pages/Landing";

function Router() {
  if (CLERK_ENABLED) {
    return (
      <>
        {/* Signed-in users see the full journal dashboard. */}
        <SignedIn>
          <Switch>
            <Route path={"/"} component={Home} />
            <Route path={"/404"} component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </SignedIn>
        {/* Signed-out visitors land on the marketing page with Clerk's
            SignIn / SignUp modals. No journal routes are reachable. */}
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
