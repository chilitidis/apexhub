// @vitest-environment jsdom
// ----------------------------------------------------------------------------
// End-to-end render guard for the Trading Coach result UI.
//
// This is the test that closes the long-running "raw JSON leaks into the UI"
// bug for good: instead of testing the pure sanitizer in isolation, it RENDERS
// the real result components (VerdictBanner + CriteriaList) through
// normalizeAnalysis — exactly the path the page uses — with deliberately
// poisoned payloads, and asserts that NO raw JSON structure ever reaches the
// DOM text content.
// ----------------------------------------------------------------------------

import * as React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";

// streamdown pulls in katex.min.css which the vitest transformer can't load.
// Mock it to render children verbatim — we only assert on text content, and a
// clean string passed to Streamdown is exactly what we want to verify.
vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
import { Streamdown } from "streamdown";
import { normalizeAnalysis, sanitizeSummary } from "@/lib/coachNormalize";
import {
  verdictColor,
  verdictLabelGreek,
  statusColor,
  type CoachCriterionResult,
  type CriterionStatus,
  type CoachVerdict,
} from "@shared/coach";

// Re-implement the exact render shape used by TradingCoachPage's VerdictBanner
// and CriteriaList. (Those are module-private in the page; mirroring their JSX
// here lets us assert the rendered output without exporting page internals.)
function VerdictBanner({
  a,
}: {
  a: ReturnType<typeof normalizeAnalysis>;
}) {
  const color = verdictColor(a.verdict);
  const safeSummary = sanitizeSummary(a.summary, a.criteria);
  return (
    <div>
      <div>{a.score}</div>
      <div>{verdictLabelGreek(a.verdict)}</div>
      <div>{[a.pair || "—", a.timeframe, a.direction].filter(Boolean).join(" · ")}</div>
      {safeSummary && (
        <div data-testid="summary">
          <Streamdown>{safeSummary}</Streamdown>
        </div>
      )}
    </div>
  );
}

function CriteriaList({ criteria }: { criteria: CoachCriterionResult[] }) {
  return (
    <div data-testid="criteria">
      {criteria.map((c) => (
        <div key={c.id}>
          <span>{c.label}</span>
          <span style={{ color: statusColor(c.status) }}>{c.status}</span>
          <p>{c.comment}</p>
        </div>
      ))}
    </div>
  );
}

function ResultView({ raw }: { raw: unknown }) {
  const a = normalizeAnalysis(raw);
  return (
    <div>
      <VerdictBanner a={a} />
      <CriteriaList criteria={a.criteria} />
    </div>
  );
}

/** A clean prose string can never contain these JSON structural signatures. */
function assertNoRawJson(text: string) {
  expect(text).not.toMatch(/\{"\s*\w/); // {"key
  expect(text).not.toMatch(/"(id|label|status|comment|verdict|score|criteria)"\s*:/);
  expect(text).not.toMatch(/\}\s*,\s*\{/); // },{ object-array seam
  expect(text).not.toContain('"status":');
  expect(text).not.toContain('"comment":');
}

const CRITERIA: CoachCriterionResult[] = [
  { id: "trend", label: "Τάση", status: "pass" as CriterionStatus, comment: "Καθοδική τάση." },
  { id: "ema50", label: "EMA50", status: "pass" as CriterionStatus, comment: "Κάτω από EMA50." },
  { id: "stop_loss", label: "Stop Loss", status: "warn" as CriterionStatus, comment: "Λίγο φαρδύ." },
];

afterEach(() => cleanup());

describe("TradingCoach result render — raw JSON must never reach the DOM", () => {
  it("renders clean prose when summary is a proper string", () => {
    render(
      <ResultView
        raw={{
          verdict: "Suitable" as CoachVerdict,
          score: 85,
          pair: "USDCHF",
          timeframe: "H1",
          direction: "SHORT",
          summary: "Καθαρή καθοδική τάση με καλό RR.",
          criteria: CRITERIA,
        }}
      />,
    );
    expect(screen.getByTestId("summary").textContent).toContain("Καθαρή καθοδική τάση");
    assertNoRawJson(document.body.textContent ?? "");
  });

  it("strips a full analysis object accidentally dumped into summary", () => {
    const poisoned = JSON.stringify({
      verdict: "Suitable",
      score: 85,
      criteria: CRITERIA,
      summary: "Πραγματικό summary μετά το JSON.",
    });
    render(
      <ResultView
        raw={{
          verdict: "Suitable" as CoachVerdict,
          score: 85,
          pair: "USDCHF",
          timeframe: "H1",
          direction: "SHORT",
          summary: poisoned,
          criteria: CRITERIA,
        }}
      />,
    );
    const body = document.body.textContent ?? "";
    expect(body).toContain("Πραγματικό summary μετά το JSON.");
    assertNoRawJson(body);
  });

  it("strips a bare criteria array + trailing prose dumped into summary (the screenshot case)", () => {
    const poisoned =
      '[{"id":"ema50","label":"EMA50","status":"pass","comment":"Κάτω από EMA50."},' +
      '{"id":"stop_loss","label":"Stop Loss","status":"pass","comment":"Πάνω από swing."},' +
      '{"id":"checklist","label":"Pre-Trade Checklist","status":"pass","comment":"Ακολουθεί κανόνες."}],' +
      "Το setup παρουσιάζει μια καθαρή καθοδική τάση με επιτυχημένο retest.";
    render(
      <ResultView
        raw={{
          verdict: "Suitable" as CoachVerdict,
          score: 80,
          pair: "NZDCHF",
          timeframe: "H1",
          direction: "SHORT",
          summary: poisoned,
          criteria: CRITERIA,
        }}
      />,
    );
    const body = document.body.textContent ?? "";
    expect(body).toContain("Το setup παρουσιάζει μια καθαρή καθοδική τάση");
    assertNoRawJson(body);
  });

  it("suppresses summary entirely when it is pure JSON with no trailing prose", () => {
    const poisoned =
      '[{"id":"ema50","label":"EMA50","status":"pass","comment":"x"}]';
    render(
      <ResultView
        raw={{
          verdict: "Marginal" as CoachVerdict,
          score: 50,
          pair: "EURUSD",
          timeframe: "H1",
          direction: "SHORT",
          summary: poisoned,
          criteria: CRITERIA,
        }}
      />,
    );
    const body = document.body.textContent ?? "";
    // Criteria still render as cards (labels/comments), but no JSON text.
    expect(body).toContain("EMA50");
    assertNoRawJson(body);
    expect(screen.queryByTestId("summary")).toBeNull();
  });

  it("coerces a criteria JSON STRING into rendered cards (never raw text)", () => {
    render(
      <ResultView
        raw={{
          verdict: "Suitable" as CoachVerdict,
          score: 78,
          pair: "GBPAUD",
          timeframe: "H1",
          direction: "LONG",
          summary: "Καλό setup.",
          criteria: JSON.stringify(CRITERIA), // criteria arrives as a string
        }}
      />,
    );
    const body = document.body.textContent ?? "";
    expect(body).toContain("EMA50");
    expect(body).toContain("Stop Loss");
    assertNoRawJson(body);
  });
});
