/**
 * Rebrand guardrail — fails if APEXHUB ever leaks back into user-visible code
 * paths (UI text, page titles, meta tags, Excel export filename).
 *
 * The few approved internal references are exempt:
 *   - localStorage keys prefixed `apexhub_*` (kept for backward compat with
 *     existing user data; never visible to the user)
 *   - the comment in importExcel.ts that documents the migration
 *   - this test file itself
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const repoRoot = resolve(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(repoRoot, rel), "utf-8");
}

describe("Rebrand guardrail (no APEXHUB in user-facing surfaces)", () => {
  it("Landing page never says APEXHUB", () => {
    const src = read("client/src/pages/Landing.tsx");
    expect(src).not.toMatch(/APEX[\s-]?HUB/i);
  });

  it("Home / dashboard never says APEXHUB", () => {
    const src = read("client/src/pages/Home.tsx");
    // The only allowed substring is the per-user localStorage key prefix.
    const visible = src.replace(/apexhub_current_balance[^`'\"]*/g, "");
    expect(visible).not.toMatch(/APEX[\s-]?HUB/i);
  });

  it("Add-trade modal never says APEXHUB", () => {
    const src = read("client/src/components/AddTradeModal.tsx");
    expect(src).not.toMatch(/APEX[\s-]?HUB/i);
  });

  it("Excel export filename uses Ultimate Trading Journal", () => {
    const src = read("client/src/lib/exportExcel.ts");
    expect(src).toMatch(/UltimateTradingJournal_\$\{/);
    expect(src).not.toMatch(/APEXHUB_\$\{/);
  });

  it("HTML title and meta tags say Ultimate Trading Journal", () => {
    const src = read("client/index.html");
    expect(src).toContain("<title>Ultimate Trading Journal</title>");
    expect(src).toMatch(/og:title.*Ultimate Trading Journal/);
    expect(src).toMatch(/twitter:title.*Ultimate Trading Journal/);
    expect(src).not.toMatch(/APEX[\s-]?HUB/i);
  });
});
