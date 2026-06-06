import { describe, it, expect } from "vitest";
import { parseForexFactoryFeed } from "./marketNewsRouter";

describe("parseForexFactoryFeed", () => {
  it("normalises a typical Forex Factory feed entry", () => {
    const raw = [
      {
        title: "ISM Manufacturing PMI",
        country: "USD",
        date: "2026-06-01T17:00:00-04:00",
        impact: "High",
        forecast: "53.3",
        previous: "52.7",
      },
    ];
    const events = parseForexFactoryFeed(raw);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.title).toBe("ISM Manufacturing PMI");
    expect(e.currency).toBe("USD");
    expect(e.impact).toBe("High");
    expect(e.forecast).toBe("53.3");
    expect(e.previous).toBe("52.7");
    expect(e.timestamp).toBe(Date.parse("2026-06-01T17:00:00-04:00"));
    expect(e.id).toContain("USD");
  });

  it("maps impact variants (case-insensitive) and defaults unknown to Low", () => {
    const raw = [
      { title: "A", country: "EUR", date: "2026-06-02T08:00:00Z", impact: "medium" },
      { title: "B", country: "GBP", date: "2026-06-02T09:00:00Z", impact: "LOW" },
      { title: "C", country: "JPY", date: "2026-06-02T10:00:00Z", impact: "Holiday" },
      { title: "D", country: "AUD", date: "2026-06-02T11:00:00Z", impact: "??" },
    ];
    const events = parseForexFactoryFeed(raw);
    expect(events.map((e) => e.impact)).toEqual([
      "Medium",
      "Low",
      "Holiday",
      "Low",
    ]);
  });

  it("sorts events chronologically by timestamp", () => {
    const raw = [
      { title: "Late", country: "USD", date: "2026-06-03T15:00:00Z", impact: "High" },
      { title: "Early", country: "USD", date: "2026-06-01T05:00:00Z", impact: "High" },
      { title: "Mid", country: "USD", date: "2026-06-02T10:00:00Z", impact: "High" },
    ];
    const events = parseForexFactoryFeed(raw);
    expect(events.map((e) => e.title)).toEqual(["Early", "Mid", "Late"]);
  });

  it("drops entries with missing title or unparseable date", () => {
    const raw = [
      { title: "", country: "USD", date: "2026-06-01T05:00:00Z", impact: "High" },
      { title: "NoDate", country: "USD", date: "", impact: "High" },
      { title: "BadDate", country: "USD", date: "not-a-date", impact: "High" },
      { title: "Good", country: "USD", date: "2026-06-01T05:00:00Z", impact: "High" },
    ];
    const events = parseForexFactoryFeed(raw);
    expect(events.map((e) => e.title)).toEqual(["Good"]);
  });

  it("handles non-array / empty input gracefully", () => {
    expect(parseForexFactoryFeed(null)).toEqual([]);
    expect(parseForexFactoryFeed(undefined)).toEqual([]);
    expect(parseForexFactoryFeed({})).toEqual([]);
    expect(parseForexFactoryFeed([])).toEqual([]);
  });

  it("defaults missing forecast/previous to empty strings and uppercases currency", () => {
    const raw = [
      { title: "Speech", country: "gbp", date: "2026-06-02T17:00:00Z", impact: "High" },
    ];
    const [e] = parseForexFactoryFeed(raw);
    expect(e.forecast).toBe("");
    expect(e.previous).toBe("");
    expect(e.currency).toBe("GBP");
  });
});
