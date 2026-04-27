export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Clerk publishable key is exposed to the browser by design.
 * Empty string means Clerk is not configured for this deployment.
 */
export const CLERK_PUBLISHABLE_KEY =
  (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) ?? "";

/**
 * Clerk is active when a publishable key is present and it has the correct
 * prefix. When active, the app gates the dashboard behind Clerk's SignIn UI
 * and every user gets their own empty journal scoped to their Clerk userId.
 */
export const CLERK_ENABLED =
  /^pk_(test|live)_/.test(CLERK_PUBLISHABLE_KEY);

/**
 * DEMO_MODE: legacy flag used when neither Manus OAuth nor Clerk is configured.
 * Kept for backward compatibility with prior Railway deployments — when Clerk
 * is active this flag is effectively ignored by the server (the Clerk path
 * takes precedence in `createContext`).
 */
export const DEMO_MODE = (() => {
  if (CLERK_ENABLED) return false;
  const forced = String(import.meta.env.VITE_DEMO_MODE ?? "").toLowerCase();
  if (forced === "true" || forced === "1") return true;

  const portal = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  return !portal || !appId;
})();

/**
 * Generate login URL at runtime.
 *   - Clerk mode: returns "/sign-in" so wouter routes to the in-app Clerk UI.
 *   - Demo mode: returns "/" so links don't escape the app.
 *   - Manus OAuth: original behaviour.
 */
export const getLoginUrl = (): string => {
  if (CLERK_ENABLED) return "/sign-in";
  if (DEMO_MODE) return "/";

  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;

  if (!oauthPortalUrl || !appId) return "/";

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
