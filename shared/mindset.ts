/**
 * Shared definitions for the Mindset Coach feature, used by both client and
 * server so the suggested starter questions and message types stay in sync.
 */

export type MindsetRole = "user" | "assistant";

export type MindsetMessage = {
  role: MindsetRole;
  content: string;
};

/** Starter questions surfaced as quick-tap chips in the chat UI. */
export const MINDSET_STARTER_QUESTIONS: ReadonlyArray<{
  id: string;
  label: string;
  prompt: string;
}> = [
  {
    id: "revenge",
    label: "Έκανα revenge trading",
    prompt:
      "Μετά από μια ζημιά μπήκα ξανά αμέσως για να την καλύψω και έχασα κι άλλο. Πώς σταματάω αυτόν τον κύκλο;",
  },
  {
    id: "fomo",
    label: "Νιώθω FOMO",
    prompt:
      "Βλέπω την αγορά να κινείται χωρίς εμένα και νιώθω ότι πρέπει να μπω τώρα. Πώς διαχειρίζομαι το FOMO;",
  },
  {
    id: "after-loss",
    label: "Δυσκολεύομαι μετά από losing day",
    prompt:
      "Μετά από μια χαμένη μέρα νιώθω άγχος και αμφιβολία για τον εαυτό μου. Πώς επανέρχομαι ψυχολογικά;",
  },
  {
    id: "discipline",
    label: "Δεν κρατάω την πειθαρχία μου",
    prompt:
      "Ξέρω το πλάνο μου αλλά δεν το ακολουθώ τη στιγμή της πίεσης. Πώς χτίζω πραγματική πειθαρχία;",
  },
];

export const MINDSET_DISCLAIMER =
  "Ο Mindset Coach προσφέρει εκπαιδευτική υποστήριξη ψυχολογίας trading — δεν αποτελεί επενδυτική ή ιατρική/ψυχολογική συμβουλή.";
