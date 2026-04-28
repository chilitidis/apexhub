import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Regression guard: the social-preview meta tags must never regress
// back to the old "Apex Hub" branding, and the og:image must point
// to a versioned URL to bust Telegram/WhatsApp link previews.
describe("client/index.html social meta tags", () => {
  const html = readFileSync(resolve(__dirname, "..", "index.html"), "utf8");

  it("sets og:title to Ultimate Trading Journal", () => {
    expect(html).toMatch(/<meta property="og:title" content="Ultimate Trading Journal"\s*\/>/);
  });

  it("exposes a 1200x630 og:image for Telegram large preview", () => {
    expect(html).toMatch(/<meta property="og:image" content="\/manus-storage\/utj-og-cover-v3_[^"]+\.png"\s*\/>/);
    expect(html).toMatch(/<meta property="og:image:width" content="1200"\s*\/>/);
    expect(html).toMatch(/<meta property="og:image:height" content="630"\s*\/>/);
  });

  it("uses summary_large_image for Twitter/X", () => {
    expect(html).toMatch(/<meta name="twitter:card" content="summary_large_image"\s*\/>/);
  });

  it("declares og:url pointing to the production domain", () => {
    expect(html).toMatch(/<meta property="og:url" content="https:\/\/ultimatradingjournal\.com\/"\s*\/>/);
  });

  it("never references legacy Apex/ApexHub branding", () => {
    expect(html.toLowerCase()).not.toContain("apex");
    expect(html.toLowerCase()).not.toContain("hub");
  });

  it("uses cache-busted favicon-v3 paths (not v2 or bare favicon)", () => {
    expect(html).toMatch(/href="\/favicon-v3\.ico"/);
    expect(html).toMatch(/href="\/favicon-v3\.png"/);
    expect(html).not.toMatch(/href="\/favicon-v2\.(ico|png)"/);
    expect(html).not.toMatch(/href="\/favicon\.(ico|png)"/);
  });
});
