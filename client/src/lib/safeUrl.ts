// lib/safeUrl.ts
// ----------------------------------------------------------------------------
// Safari throws a DOMException ("The string did not match the expected
// pattern.") from `new URL(...)` when the input is relative or contains
// characters its URL parser rejects. These helpers never throw, so click
// handlers and effects that read query params or validate links stay robust
// across browsers.
// ----------------------------------------------------------------------------

/** Parse a URL without ever throwing. Returns null on failure. */
export function safeParseUrl(input: string, base?: string): URL | null {
  try {
    return base ? new URL(input, base) : new URL(input);
  } catch {
    // Retry with the current origin as a base for relative paths.
    try {
      if (typeof window !== "undefined") {
        return new URL(input, window.location.origin);
      }
    } catch {
      /* ignore */
    }
    return null;
  }
}

/** True if the string is a valid absolute http(s) URL. Never throws. */
export function isHttpUrl(input: string): boolean {
  const t = (input ?? "").trim();
  if (!t) return false;
  const u = safeParseUrl(t);
  return !!u && (u.protocol === "https:" || u.protocol === "http:");
}

/**
 * Read the current location's query params without using `new URL()` on the
 * full href (which can throw in Safari). `URLSearchParams` is forgiving.
 */
export function getQueryParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
}

/**
 * Remove one or more query params from the current URL and update history,
 * without throwing. No-op on the server.
 */
export function stripQueryParams(...keys: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    let changed = false;
    for (const k of keys) {
      if (params.has(k)) {
        params.delete(k);
        changed = true;
      }
    }
    if (!changed) return;
    const qs = params.toString();
    const cleanPath = window.location.pathname + (qs ? `?${qs}` : "");
    window.history.replaceState({}, "", cleanPath);
  } catch {
    /* ignore */
  }
}

/** Safely format a date value to a locale string. Returns fallback if invalid. */
export function safeFormatDate(
  value: Date | string | number | null | undefined,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
  fallback = "",
): string {
  if (value === null || value === undefined) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  try {
    return d.toLocaleDateString(locale, options);
  } catch {
    try {
      return d.toLocaleDateString();
    } catch {
      return fallback;
    }
  }
}

/** Safely format a time value. Returns fallback if invalid. */
export function safeFormatTime(
  value: Date | string | number | null | undefined,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
  fallback = "",
): string {
  if (value === null || value === undefined) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  try {
    return d.toLocaleTimeString(locale, options);
  } catch {
    try {
      return d.toLocaleTimeString();
    } catch {
      return fallback;
    }
  }
}
