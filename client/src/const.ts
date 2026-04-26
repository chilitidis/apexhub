export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * DEMO_MODE: when the Manus OAuth env vars are not configured (e.g. on Railway,
 * Vercel, or any self-hosted deployment), the app runs without external auth
 * and presents a built-in demo user. This keeps the dashboard usable while
 * downstream auth (Clerk / Auth0 / NextAuth / etc.) is being wired in.
 *
 * Triggered automatically when either VITE_OAUTH_PORTAL_URL or VITE_APP_ID is
 * empty/undefined at build time. Can also be forced with VITE_DEMO_MODE=true.
 */
export const DEMO_MODE = (() => {
  const forced = String(import.meta.env.VITE_DEMO_MODE ?? "").toLowerCase();
  if (forced === "true" || forced === "1") return true;

  const portal = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  return !portal || !appId;
})();

/**
 * Generate login URL at runtime so redirect URI reflects the current origin.
 * In DEMO_MODE returns the dashboard root so links don't escape the app.
 */
export const getLoginUrl = (): string => {
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
