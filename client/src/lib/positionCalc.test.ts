import { describe, it, expect } from "vitest";
import {
  computePosition,
  findInstrument,
  instrumentsByCategory,
  resolveConversionRate,
  PositionCalcError,
  type PositionInput,
} from "./positionCalc";

function base(overrides: Partial<PositionInput> = {}): PositionInput {
  return {
    balance: 10_000,
    accountCurrency: "USD",
    riskMode: "percent",
    riskPercent: 1,
    riskAmount: 0,
    entry: 1.1,
    stopLoss: 1.09,
    contractSize: 100_000,
    quoteCurrency: "USD",
    pipSize: 0.0001,
    conversionRate: 1,
    ...overrides,
  };
}

describe("computePosition — Forex", () => {
  it("EURUSD: 1% of $10k, 100-pip stop → 0.10 lots", () => {
    // moneyRisked = 100, stopDistance = 0.01, lossPerLot = 100000*0.01 = 1000
    // lots = 100 / 1000 = 0.10
    const r = computePosition(base());
    expect(r.moneyRisked).toBe(100);
    expect(r.stopDistancePips).toBe(100);
    expect(r.lossPerLot).toBe(1000);
    expect(r.lotSize).toBe(0.1);
  });

  it("honours a fixed risk amount instead of percent", () => {
    const r = computePosition(base({ riskMode: "amount", riskAmount: 250 }));
    expect(r.moneyRisked).toBe(250);
    expect(r.lotSize).toBe(0.25);
  });

  it("JPY pair: pip distance uses 0.01 pip size", () => {
    // USDJPY entry 150.00 stop 149.50 → 0.5 price → 50 pips
    const r = computePosition(
      base({ entry: 150, stopLoss: 149.5, quoteCurrency: "JPY", pipSize: 0.01, conversionRate: 1 / 150 }),
    );
    expect(r.stopDistancePips).toBe(50);
    // lossPerLot = 100000 * 0.5 * (1/150) = 333.33
    expect(r.lossPerLot).toBeCloseTo(333.33, 1);
  });
});

describe("computePosition — Indices / Metals / Crypto", () => {
  it("US30 index: 1 contract = $1/point", () => {
    // entry 40000 stop 39900 → 100 points; lossPerLot = 1*100*1 = 100
    const r = computePosition(
      base({ entry: 40000, stopLoss: 39900, contractSize: 1, pipSize: 1, riskAmount: 500, riskMode: "amount" }),
    );
    expect(r.stopDistancePips).toBe(100);
    expect(r.lossPerLot).toBe(100);
    expect(r.lotSize).toBe(5); // 500 / 100
  });

  it("Gold XAUUSD: 100 oz contract", () => {
    // entry 2400 stop 2390 → 10 price; lossPerLot = 100*10*1 = 1000
    const r = computePosition(
      base({ entry: 2400, stopLoss: 2390, contractSize: 100, pipSize: 0.1, riskAmount: 200, riskMode: "amount" }),
    );
    expect(r.lossPerLot).toBe(1000);
    expect(r.lotSize).toBe(0.2);
  });

  it("Bitcoin: 1 lot = 1 coin", () => {
    // entry 60000 stop 59000 → 1000 price; lossPerLot = 1*1000*1 = 1000
    const r = computePosition(
      base({ entry: 60000, stopLoss: 59000, contractSize: 1, pipSize: 1, riskAmount: 100, riskMode: "amount" }),
    );
    expect(r.lossPerLot).toBe(1000);
    expect(r.lotSize).toBe(0.1);
  });
});

describe("computePosition — currency conversion", () => {
  it("applies quote→account conversion rate", () => {
    // GER40 index quoted in EUR, account in USD. lossPerLot in EUR = 100,
    // rate EUR→USD = 1.1 → 110 USD.
    const r = computePosition(
      base({ accountCurrency: "USD", entry: 18000, stopLoss: 17900, contractSize: 1, pipSize: 1, quoteCurrency: "EUR", conversionRate: 1.1, riskAmount: 220, riskMode: "amount" }),
    );
    expect(r.lossPerLot).toBe(110);
    expect(r.lotSize).toBe(2); // 220 / 110
  });
});

describe("computePosition — validation", () => {
  it("throws when entry equals stop", () => {
    expect(() => computePosition(base({ entry: 1.1, stopLoss: 1.1 }))).toThrow(PositionCalcError);
  });
  it("throws when balance <= 0", () => {
    expect(() => computePosition(base({ balance: 0 }))).toThrow(PositionCalcError);
  });
  it("throws when risk % exceeds 100", () => {
    expect(() => computePosition(base({ riskPercent: 150 }))).toThrow(PositionCalcError);
  });
  it("throws when conversion rate <= 0", () => {
    expect(() => computePosition(base({ conversionRate: 0 }))).toThrow(PositionCalcError);
  });
  it("warns on aggressive (>10%) risk", () => {
    const r = computePosition(base({ riskPercent: 15 }));
    expect(r.warnings.some((w) => w.includes("10%"))).toBe(true);
  });
});

describe("instrument catalogue", () => {
  it("has all four categories populated", () => {
    expect(instrumentsByCategory("forex").length).toBeGreaterThan(5);
    expect(instrumentsByCategory("indices").length).toBeGreaterThan(3);
    expect(instrumentsByCategory("metals").length).toBeGreaterThanOrEqual(2);
    expect(instrumentsByCategory("crypto").length).toBeGreaterThanOrEqual(3);
  });
  it("resolves a known symbol", () => {
    expect(findInstrument("EURUSD")?.contractSize).toBe(100_000);
    expect(findInstrument("XAUUSD")?.contractSize).toBe(100);
    expect(findInstrument("US30")?.quoteCurrency).toBe("USD");
  });
});

describe("resolveConversionRate — automatic FX", () => {
  it("quote == account → rate 1, exact", () => {
    // EURUSD on a USD account: P&L already in USD.
    const r = resolveConversionRate({ baseCurrency: "EUR", quoteCurrency: "USD", account: "USD", entry: 1.1 });
    expect(r.rate).toBe(1);
    expect(r.approximate).toBe(false);
  });

  it("base == account → rate = 1/entry, exact", () => {
    // USDJPY on a USD account: loss in JPY; 1 JPY = 1/entry USD.
    const r = resolveConversionRate({ baseCurrency: "USD", quoteCurrency: "JPY", account: "USD", entry: 150 });
    expect(r.rate).toBeCloseTo(1 / 150, 8);
    expect(r.approximate).toBe(false);
  });

  it("EURUSD on a EUR account → derives from entry (1/entry), exact", () => {
    // base EUR == account EUR → rate = 1/entry.
    const r = resolveConversionRate({ baseCurrency: "EUR", quoteCurrency: "USD", account: "EUR", entry: 1.08 });
    expect(r.rate).toBeCloseTo(1 / 1.08, 8);
    expect(r.approximate).toBe(false);
  });

  it("GBPJPY on a EUR account → static fallback, approximate", () => {
    // Neither leg is EUR → uses built-in FX table.
    const r = resolveConversionRate({ baseCurrency: "GBP", quoteCurrency: "JPY", account: "EUR", entry: 190 });
    expect(r.rate).toBeGreaterThan(0);
    expect(r.approximate).toBe(true);
  });
});

describe("end-to-end with auto conversion", () => {
  it("EURUSD on EUR account, 1% of €20k, 100-pip stop", () => {
    const entry = 1.1, stop = 1.09;
    const { rate } = resolveConversionRate({ baseCurrency: "EUR", quoteCurrency: "USD", account: "EUR", entry });
    const r = computePosition(
      base({ balance: 20_000, accountCurrency: "EUR", entry, stopLoss: stop, quoteCurrency: "USD", conversionRate: rate }),
    );
    // moneyRisked = 200 EUR; lossPerLot = 100000 * 0.01 * (1/1.1) ≈ 909.09 EUR
    expect(r.moneyRisked).toBe(200);
    expect(r.lossPerLot).toBeCloseTo(909.09, 1);
    // lots = 200 / 909.09 ≈ 0.22
    expect(r.lotSize).toBeCloseTo(0.22, 2);
  });
});

describe("forex catalogue completeness", () => {
  it("includes majors, crosses and exotics", () => {
    const fx = instrumentsByCategory("forex").map((i) => i.symbol);
    ["EURUSD", "GBPUSD", "USDJPY", "EURGBP", "GBPJPY", "AUDNZD", "USDTRY", "EURPLN"].forEach((s) => {
      expect(fx).toContain(s);
    });
    expect(fx.length).toBeGreaterThanOrEqual(30);
  });
  it("every forex instrument exposes base & quote currency", () => {
    instrumentsByCategory("forex").forEach((i) => {
      expect(i.baseCurrency).toMatch(/^[A-Z]{3}$/);
      expect(i.quoteCurrency).toMatch(/^[A-Z]{3}$/);
    });
  });
});
