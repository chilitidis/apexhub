import { describe, it, expect } from "vitest";
import { isNeutralAccent } from "./AdminUsersPage";

describe("isNeutralAccent (Admin StatCard value color)", () => {
  it("treats white hex as neutral so it follows the theme foreground", () => {
    // The 'Registered (unique)' card uses #FFFFFF — must be neutral so the
    // number stays visible in light mode (white-on-white bug).
    expect(isNeutralAccent("#FFFFFF")).toBe(true);
    expect(isNeutralAccent("#ffffff")).toBe(true);
    expect(isNeutralAccent("#FFF")).toBe(true);
    expect(isNeutralAccent("#fff")).toBe(true);
    expect(isNeutralAccent("  #FFFFFF  ")).toBe(true);
    expect(isNeutralAccent("white")).toBe(true);
  });

  it("keeps colored accents non-neutral so they render with their own color", () => {
    expect(isNeutralAccent("#F4A261")).toBe(false); // trialing
    expect(isNeutralAccent("#00C896")).toBe(false); // active
    expect(isNeutralAccent("#6E8AA8")).toBe(false); // no plan
    expect(isNeutralAccent("#0077B6")).toBe(false); // ocean
  });
});
