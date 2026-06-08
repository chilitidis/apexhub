/**
 * Shared reply sanitizers for the AI coaches.
 *
 * These helpers keep coach replies clean and on-brand:
 *  - `stripSourceRefs` removes any citation/source references the model might
 *    leak (lesson numbers, guide/book names, sections, file names, brand
 *    words). The coaches must present knowledge as their own and never reveal
 *    which document it came from.
 *  - `stripBase64Blobs` removes data: URIs and long base64-looking runs.
 *  - `cleanProse` is the markdown-safe sanitizer applied to conversational
 *    replies; it preserves lists/bold/headings while stripping the above.
 *
 * Both the Trading Coach (coachRouter) and Mindset Coach (mindsetRouter) import
 * from here so the "no source citations" rule is enforced identically.
 */

/**
 * Remove any citation/source references the model might leak (lesson numbers,
 * guide/book names, sections, file names, brand words). The coach must present
 * knowledge as its own and never reveal which PDF/source it came from.
 */
export function stripSourceRefs(input: string): string {
  if (!input) return "";
  let s = input;

  // Parenthetical citations: (Μάθημα 8), (Κεφάλαιο 2), (ενότητα 3),
  // ("ApexHub VIP — Συμπληρωματικός Οδηγός", ενότητα 2), (βλ. Μάθημα 11) ...
  s = s.replace(
    /[\(\[][^()\[\]]*(?:Μάθημα|Μαθήματα|Κεφάλαιο|Κεφ\.?|ενότητ[α-ωά-ώ]*|ApexHub|Οδηγ[α-ωά-ώ]*|Συμπληρωματικ[α-ωά-ώ]*|βιβλί[α-ωά-ώ]*|module|lesson|chapter|section|guide)[^()\[\]]*[\)\]]/gi,
    "",
  );

  // Inline lead-ins like: ", όπως λέει το Μάθημα 11 — Breakout & Retest"
  // or "όπως περιγράφεται στον ApexHub VIP — Οδηγό Σύνδεσης MT5,"
  // Strip the citation clause up to the next sentence/clause boundary.
  s = s.replace(
    /[,;]?\s*(?:όπως|καθώς|σύμφωνα με|βάσει|βλ\.?|δες|αναφέρ[α-ωά-ώ]*|περιγράφ[α-ωά-ώ]*)[^.\n!?·]*?(?:Μάθημα|Μαθήμα[α-ωά-ώ]*|Κεφάλαιο|Κεφ\.?|ενότητ[α-ωά-ώ]*|ApexHub|Συμπληρωματικ[α-ωά-ώ]*|checklist\s+μας|οδηγ[α-ωά-ώ]*|ύλη[α-ωά-ώ]*|webinar|βιβλιογραφί[α-ωά-ώ]*)[^.\n!?·]*/gi,
    "",
  );

  // Bare standalone references: "Μάθημα 12", "Κεφάλαιο 3", "ενότητα 2",
  // "ApexHub VIP", "Πυλώνας 11", "webinar".
  s = s.replace(/(?:Μάθημα|Μαθήματα|Κεφάλαιο|Κεφ\.)\s*\d+[α-ωά-ώ]*/gi, "");
  s = s.replace(/ενότητα\s*\d+/gi, "");
  s = s.replace(/Πυλών[α-ωά-ώ]*\s*\d+/gi, "");
  s = s.replace(/ApexHub(?:\s+VIP)?/gi, "");
  s = s.replace(/Titans/gi, "");
  s = s.replace(/Συμπληρωματικ[α-ωά-ώ]*\s+Οδηγ[α-ωά-ώ]*/gi, "");

  // Tidy up artefacts left behind (double punctuation/spaces, dangling dashes).
  s = s.replace(/\s*[—–-]\s*(?=[.,;·!?\n)\]]|$)/g, "");
  s = s.replace(/\(\s*\)/g, "");
  s = s.replace(/\s+([.,;·!?])/g, "$1");
  s = s.replace(/([.,;·])\1+/g, "$1");
  s = s.replace(/[ \t]{2,}/g, " ");
  return s;
}

/** Strip data: URIs and any long base64-looking run from a text field. */
export function stripBase64Blobs(input: string): string {
  if (!input) return "";
  let out = input;
  out = out.replace(/data:[a-zA-Z0-9.+/-]+;base64,[A-Za-z0-9+/=]+/g, " ");
  out = out.replace(/[A-Za-z0-9+/]{80,}={0,2}/g, " ");
  return out;
}

/**
 * Sanitizer for conversational (markdown) replies: strips base64 blobs and
 * source references, but PRESERVES markdown formatting (lists, bold, headings)
 * so the chat renders nicely. Use only for free-form prose, never for the
 * structured analysis fields.
 *
 * When `max` is omitted, replies are NOT truncated so the coach can give
 * complete, multi-step explanations.
 */
export function cleanProse(input: unknown, max?: number): string {
  if (typeof input !== "string") return "";
  let s = stripBase64Blobs(input);
  s = stripSourceRefs(s);
  // Collapse 3+ newlines to a max of 2 (keep paragraph breaks).
  s = s.replace(/\n{3,}/g, "\n\n");
  // Trim trailing spaces on each line.
  s = s
    .split("\n")
    .map((ln) => ln.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
  if (typeof max === "number" && s.length > max) s = s.slice(0, max).trim() + "…";
  return s;
}
