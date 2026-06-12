import { describe, it, expect } from "vitest";
import { fmtEuroCompact } from "@/pages/CalendarPage";

describe("fmtEuroCompact (compact calendar amount format for mobile)", () => {
  it("formats small amounts without k suffix", () => {
    expect(fmtEuroCompact(0)).toBe("0€");
    expect(fmtEuroCompact(250)).toBe("+250€");
    expect(fmtEuroCompact(-880)).toBe("−880€");
  });

  it("formats thousands with a single-decimal k suffix", () => {
    expect(fmtEuroCompact(12565)).toBe("+12.6k€");
    expect(fmtEuroCompact(6882)).toBe("+6.9k€");
    expect(fmtEuroCompact(-5355)).toBe("−5.4k€");
  });

  it("drops the decimal for round thousands and large values", () => {
    expect(fmtEuroCompact(16000)).toBe("+16k€");
    expect(fmtEuroCompact(120000)).toBe("+120k€");
    expect(fmtEuroCompact(-100000)).toBe("−100k€");
  });

  it("handles non-finite input gracefully", () => {
    expect(fmtEuroCompact(NaN)).toBe("—");
    expect(fmtEuroCompact(Infinity)).toBe("—");
  });
});
