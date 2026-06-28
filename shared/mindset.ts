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
  /** Greek label/prompt (default UI fallback). */
  label: string;
  prompt: string;
  /** English label/prompt, shown when the UI language is English. */
  label_en: string;
  prompt_en: string;
}> = [
  {
    id: "revenge",
    label: "Έκανα revenge trading",
    prompt:
      "Μετά από μια ζημιά μπήκα ξανά αμέσως για να την καλύψω και έχασα κι άλλο. Πώς σταματάω αυτόν τον κύκλο;",
    label_en: "I did revenge trading",
    prompt_en:
      "After a loss I jumped straight back in to win it back and lost even more. How do I stop this cycle?",
  },
  {
    id: "fomo",
    label: "Νιώθω FOMO",
    prompt:
      "Βλέπω την αγορά να κινείται χωρίς εμένα και νιώθω ότι πρέπει να μπω τώρα. Πώς διαχειρίζομαι το FOMO;",
    label_en: "I feel FOMO",
    prompt_en:
      "I watch the market move without me and feel I have to get in right now. How do I manage FOMO?",
  },
  {
    id: "after-loss",
    label: "Δυσκολεύομαι μετά από losing day",
    prompt:
      "Μετά από μια χαμένη μέρα νιώθω άγχος και αμφιβολία για τον εαυτό μου. Πώς επανέρχομαι ψυχολογικά;",
    label_en: "I struggle after a losing day",
    prompt_en:
      "After a losing day I feel anxious and full of self-doubt. How do I recover psychologically?",
  },
  {
    id: "discipline",
    label: "Δεν κρατάω την πειθαρχία μου",
    prompt:
      "Ξέρω το πλάνο μου αλλά δεν το ακολουθώ τη στιγμή της πίεσης. Πώς χτίζω πραγματική πειθαρχία;",
    label_en: "I can't keep my discipline",
    prompt_en:
      "I know my plan but I don't follow it in the heat of the moment. How do I build real discipline?",
  },
];

export const MINDSET_DISCLAIMER =
  "Ο Mindset Coach προσφέρει εκπαιδευτική υποστήριξη ψυχολογίας trading — δεν αποτελεί επενδυτική ή ιατρική/ψυχολογική συμβουλή.";

export const MINDSET_DISCLAIMER_EN =
  "The Mindset Coach offers educational trading-psychology support — it is not investment or medical/psychological advice.";
