// Client-side mirror of the Market News event shape returned by the server.
// Kept tiny & decoupled so the UI never depends on Forex Factory field names.

export type MarketImpact = "High" | "Medium" | "Low" | "Holiday";

export interface MarketEvent {
  id: string;
  title: string;
  currency: string;
  /** ISO-8601 string with upstream timezone offset. */
  date: string;
  /** Unix ms — for local formatting & grouping. */
  timestamp: number;
  impact: MarketImpact;
  forecast: string;
  previous: string;
}
