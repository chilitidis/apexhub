import { describe, it, expect } from "vitest";
import { translations } from "@/lib/i18n";
import { LANDING_CONTENT } from "@/lib/landingContent";

describe("i18n dictionary", () => {
  it("exposes both en and el tables", () => {
    expect(translations.en).toBeDefined();
    expect(translations.el).toBeDefined();
  });

  it("keeps identical key sets across languages", () => {
    const enKeys = Object.keys(translations.en).sort();
    const elKeys = Object.keys(translations.el).sort();
    expect(elKeys).toEqual(enKeys);
  });

  it("keeps the EN nav label in English", () => {
    expect(translations.en["nav.pricing"]).toBe("Pricing");
  });

  it("translates the EL nav label to Greek", () => {
    expect(translations.el["nav.pricing"]).toBe("Τιμές");
  });
});

describe("landing content", () => {
  it("provides full content for both languages", () => {
    expect(LANDING_CONTENT.en).toBeDefined();
    expect(LANDING_CONTENT.el).toBeDefined();
  });

  it("uses real Stripe prices in both languages", () => {
    for (const lang of ["en", "el"] as const) {
      const prices = LANDING_CONTENT[lang].pricing.plans.map((p) => p.price);
      expect(prices).toContain("€39.99");
      expect(prices).toContain("€199.99");
      expect(prices).toContain("€399.99");
    }
  });

  it("keeps the same number of feature cards in both languages", () => {
    expect(LANDING_CONTENT.en.features.items.length).toBe(
      LANDING_CONTENT.el.features.items.length,
    );
  });

  it("keeps trading terms in English in the Greek hero subtitle", () => {
    const el = LANDING_CONTENT.el.hero.subtitle;
    expect(el).toContain("MT5");
    expect(el).toContain("analytics");
  });

  it("keeps three pricing plans in both languages", () => {
    expect(LANDING_CONTENT.en.pricing.plans.length).toBe(3);
    expect(LANDING_CONTENT.el.pricing.plans.length).toBe(3);
  });

  it("uses the same feature icon keys across languages", () => {
    const enIcons = LANDING_CONTENT.en.features.items.map((f) => f.icon);
    const elIcons = LANDING_CONTENT.el.features.items.map((f) => f.icon);
    expect(elIcons).toEqual(enIcons);
  });
});
