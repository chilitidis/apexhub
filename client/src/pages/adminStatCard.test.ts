import { describe, it, expect } from "vitest";
import { isNeutralAccent } from "./AdminUsersPage";

describe("isNeutralAccent (Admin StatCard value color)", () => {
  it("treats white hex as neutral so it follows the theme foreground", () => {
    // The 'Registered (unique)' card uses #F2EFE8 — must be neutral so the
    // number stays visible in light mode (white-on-white bug).
    expect(isNeutralAccent("#F2EFE8")).toBe(true);
    expect(isNeutralAccent("#F2EFE8")).toBe(true);
    expect(isNeutralAccent("#FFF")).toBe(true);
    expect(isNeutralAccent("#fff")).toBe(true);
    expect(isNeutralAccent("  #F2EFE8  ")).toBe(true);
    expect(isNeutralAccent("white")).toBe(true);
  });

  it("keeps colored accents non-neutral so they render with their own color", () => {
    expect(isNeutralAccent("#C9A24A")).toBe(false); // trialing
    expect(isNeutralAccent("#3FB68B")).toBe(false); // active
    expect(isNeutralAccent("#8E8A82")).toBe(false); // no plan
    expect(isNeutralAccent("#C9A24A")).toBe(false); // ocean
  });
});
