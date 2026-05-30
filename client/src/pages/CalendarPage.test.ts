import { describe, expect, it } from "vitest";
import {
  buildMonthCells,
  dayKey,
  fmtEuroShort,
  isoWeekdayIndex,
  parseTradeDate,
} from "./CalendarPage";

describe("CalendarPage helpers", () => {
  describe("dayKey", () => {
    it("formats local-date as YYYY-MM-DD with zero padding", () => {
      const d = new Date(2026, 0, 5); // Jan 5, 2026 local
      expect(dayKey(d)).toBe("2026-01-05");
    });
    it("two-digit month and day", () => {
      const d = new Date(2026, 11, 31); // Dec 31, 2026 local
      expect(dayKey(d)).toBe("2026-12-31");
    });
  });

  describe("isoWeekdayIndex", () => {
    it("Monday is 0", () => {
      // 2026-04-06 is a Monday
      expect(isoWeekdayIndex(new Date(2026, 3, 6))).toBe(0);
    });
    it("Sunday is 6", () => {
      // 2026-04-12 is a Sunday
      expect(isoWeekdayIndex(new Date(2026, 3, 12))).toBe(6);
    });
  });

  describe("buildMonthCells", () => {
    it("always returns exactly 42 cells", () => {
      expect(buildMonthCells(2026, 0)).toHaveLength(42);
      expect(buildMonthCells(2026, 1)).toHaveLength(42); // Feb
      expect(buildMonthCells(2026, 11)).toHaveLength(42);
    });

    it("marks days in the requested month with inMonth=true", () => {
      const cells = buildMonthCells(2026, 3); // April 2026
      const inMonth = cells.filter((c) => c.inMonth).length;
      // April has 30 days
      expect(inMonth).toBe(30);
    });

    it("starts on a Monday slot for any month", () => {
      const cells = buildMonthCells(2026, 3);
      // The first cell's weekday must be Monday (isoWeekdayIndex === 0)
      expect(isoWeekdayIndex(cells[0].date)).toBe(0);
    });
  });

  describe("fmtEuroShort", () => {
    it("formats positives with + and €", () => {
      expect(fmtEuroShort(1500)).toBe("+1,500€");
    });
    it("formats negatives with the minus sign", () => {
      expect(fmtEuroShort(-1500)).toBe("−1,500€"); // U+2212
    });
    it("returns 0€ unsigned when value is 0", () => {
      expect(fmtEuroShort(0)).toBe("0€");
    });
    it("rounds smaller values to no decimals", () => {
      expect(fmtEuroShort(12.7)).toBe("+13€");
    });
    it("returns em-dash on NaN", () => {
      expect(fmtEuroShort(NaN)).toBe("—");
    });
  });

  describe("parseTradeDate", () => {
    it("parses ISO strings", () => {
      const d = parseTradeDate("2026-04-01T10:00:00Z");
      expect(d).not.toBeNull();
      expect(d!.getUTCFullYear()).toBe(2026);
    });
    it("returns null for falsy or invalid input", () => {
      expect(parseTradeDate("")).toBeNull();
      expect(parseTradeDate(null)).toBeNull();
      expect(parseTradeDate("not-a-date")).toBeNull();
    });
  });
});
