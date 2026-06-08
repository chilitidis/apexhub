import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { MINDSET_KNOWLEDGE } from "./mindsetKnowledge";
import { cleanProse } from "./sanitizers";

/**
 * Mindset Coach router.
 *
 * A grounded trading-psychology chat. The LLM answers strictly from our own
 * curated knowledge base (server/mindsetKnowledge.ts), in Greek, with a warm
 * but direct coaching voice. Conversation history is supplied by the client
 * (the chat is stateless on the server side — no persistence needed for a
 * Q&A assistant). Output is markdown, rendered by <Streamdown> on the client.
 */

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const inputSchema = z.object({
  /** Full conversation so far; the last item must be the new user message. */
  messages: z.array(messageSchema).min(1).max(40),
});

export const mindsetRouter = router({
  /**
   * Returns a markdown coaching reply grounded in the knowledge base. Falls
   * back to a supportive deterministic message if the LLM is unavailable.
   */
  chat: protectedProcedure
    .input(inputSchema)
    .mutation(async ({ input }) => {
      const last = input.messages[input.messages.length - 1];
      if (last.role !== "user") {
        // Defensive: the client should always send a user turn last.
        return {
          reply: FALLBACK_REPLY,
          source: "fallback" as const,
          generatedAt: Date.now(),
        };
      }

      try {
        const res = await invokeLLM({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...input.messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          ],
        });

        const text = res?.choices?.[0]?.message?.content;
        // Sanitize: strip any leaked source/lesson/PDF references so the coach
        // presents the knowledge as its own (same rule as the Trading Coach).
        const cleaned = typeof text === "string" ? cleanProse(text) : "";
        const reply =
          cleaned.trim().length > 0 ? cleaned.trim() : FALLBACK_REPLY;
        return {
          reply,
          source: (reply === FALLBACK_REPLY ? "fallback" : "llm") as
            | "llm"
            | "fallback",
          generatedAt: Date.now(),
        };
      } catch {
        return {
          reply: FALLBACK_REPLY,
          source: "fallback" as const,
          generatedAt: Date.now(),
        };
      }
    }),
});

const SYSTEM_PROMPT = [
  "Είσαι ο «Mindset Coach» — ένας έμπειρος προπονητής ψυχολογίας trading.",
  "Μιλάς ΑΥΣΤΗΡΑ στα Ελληνικά, με ζεστό αλλά ευθύ, ενθαρρυντικό και ώριμο τόνο — σαν μέντορας, όχι σαν θεραπευτής και όχι σαν ρομπότ.",
  "Απαντάς ΜΟΝΟ πάνω σε θέματα ψυχολογίας/νοοτροπίας trading (συναισθήματα, πειθαρχία, ταυτότητα, συνήθειες, αυτοέλεγχος, προσδοκίες).",
  "Η γνώση σου προέρχεται ΑΠΟΚΛΕΙΣΤΙΚΑ από την παρακάτω Βάση Γνώσης. Στήριξε τις απαντήσεις σου σε αυτές τις αρχές, έννοιες, ασκήσεις και mantras. ΜΗΝ εφεύρεις ξένες θεωρίες.",
  "ΠΟΤΕ μην αποκαλύπτεις την πηγή της γνώσης σου: μην αναφέρεις τίτλους εγγράφων, ονόματα αρχείων ή PDF, αριθμούς μαθημάτων, κεφαλαίων, ενοτήτων ή «πυλώνων», ούτε webinar ή βιβλιογραφία. Παρουσίαζε τη γνώση σαν δική σου εμπειρία προπονητή — ποτέ ως παραπομπή σε υλικό.",
  "Αν κάποιος ρωτήσει κάτι εκτός ψυχολογίας (π.χ. συγκεκριμένο setup, σήμα αγοράς/πώλησης, πρόβλεψη τιμής), ευγενικά εξήγησε ότι εσύ εστιάζεις στη νοοτροπία και παρέπεμψέ τον στα αντίστοιχα εργαλεία (Trading Coach, Pre-Market Briefing).",
  "Στυλ απάντησης: σύντομη ενσυναίσθηση/αναγνώριση του συναισθήματος → καθαρή εξήγηση του τι συμβαίνει ψυχολογικά → 2-4 πρακτικά, εφαρμόσιμα βήματα ή μία άσκηση → προαιρετικά ένα σύντομο mantra. Χρησιμοποίησε Markdown (έντονα, σύντομες λίστες) αλλά κράτησέ το ανθρώπινο και όχι υπερβολικά μακροσκελές.",
  "Κάνε διευκρινιστική ερώτηση όταν το ζήτημα είναι ασαφές, αντί να υποθέτεις.",
  "ΠΟΤΕ μη δίνεις επενδυτική συμβουλή ή εγγύηση αποτελεσμάτων. Δεν είσαι υποκατάστατο επαγγελματία ψυχικής υγείας· αν κάποιος εκφράσει σοβαρή ψυχολογική κρίση, πρότεινε με σεβασμό να απευθυνθεί σε ειδικό.",
  "",
  "===== ΒΑΣΗ ΓΝΩΣΗΣ (η μόνη σου πηγή) =====",
  MINDSET_KNOWLEDGE,
].join("\n");

const FALLBACK_REPLY = [
  "Σε ακούω. Πάρε πρώτα μια βαθιά ανάσα — αυτό που νιώθεις είναι κομμάτι της διαδικασίας, όχι απόδειξη ότι απέτυχες.",
  "",
  "Θυμήσου τη **Διχότομη του Ελέγχου**: ελέγχεις τις αποφάσεις, την προετοιμασία και την αντίδρασή σου — όχι την κίνηση της αγοράς ή το αποτέλεσμα ενός μεμονωμένου trade.",
  "",
  "Ένα μικρό βήμα τώρα: κάνε την άσκηση **STOP** — *Stop, Take a breath, Observe, Proceed* — πριν την επόμενη απόφασή σου.",
  "",
  "*Η υπηρεσία AI είναι προσωρινά μη διαθέσιμη· δοκίμασε ξανά σε λίγο για πιο εξατομικευμένη απάντηση.*",
].join("\n");

export const __test__ = { SYSTEM_PROMPT, FALLBACK_REPLY };
