// MindsetCoachPage — conversational trading-psychology coach.
// Grounded chat (trpc.mindset.chat) answering strictly from our own curated
// knowledge base. Dark navy "Ocean Depth" theme to match the dashboard.

import { useCallback, useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { Brain, Send, Loader2, User, Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  MINDSET_STARTER_QUESTIONS,
  MINDSET_DISCLAIMER,
  type MindsetMessage,
} from "@shared/mindset";

const ACCENT = "#5E60CE"; // violet — the coach/education accent used app-wide

function WelcomeCard({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="text-center max-w-2xl mx-auto py-8">
      <div
        className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
        style={{ background: `${ACCENT}1A`, color: ACCENT }}
      >
        <Brain size={30} />
      </div>
      <h2 className="font-['Space_Grotesk'] text-2xl font-bold text-white">
        Πώς νιώθεις σήμερα ως trader;
      </h2>
      <p className="text-sm text-[#A8B5C7] mt-2">
        Μίλησέ μου για ό,τι σε απασχολεί ψυχολογικά — φόβο, ανυπομονησία,
        πειθαρχία, αμφιβολία. Είμαι εδώ για να σε βοηθήσω να χτίσεις σταθερή
        νοοτροπία.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mt-7 text-left">
        {MINDSET_STARTER_QUESTIONS.map((q) => (
          <button
            key={q.id}
            onClick={() => onPick(q.prompt)}
            className="group rounded-xl border border-white/8 bg-[#0D1E35]/70 hover:border-white/20 px-4 py-3 transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={14} style={{ color: ACCENT }} />
              <span className="font-semibold text-sm text-white">
                {q.label}
              </span>
            </div>
            <p className="text-xs text-[#7E8DA3] mt-1 line-clamp-2">
              {q.prompt}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: MindsetMessage }) {
  const isUser = msg.role === "user";
  return (
    <div
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <div
        className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg"
        style={
          isUser
            ? { background: "#0077B61A", color: "#0077B6" }
            : { background: `${ACCENT}1A`, color: ACCENT }
        }
      >
        {isUser ? <User size={16} /> : <Brain size={16} />}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "bg-[#0077B6]/15 text-[#E6EEF8]"
            : "bg-[#0D1E35]/80 border border-white/8 text-[#D6DEEA]"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:text-white prose-strong:text-white">
            <Streamdown>{msg.content}</Streamdown>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MindsetCoachPage() {
  const [messages, setMessages] = useState<MindsetMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const chat = trpc.mindset.chat.useMutation();

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, chat.isPending]);

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || chat.isPending) return;

      const next: MindsetMessage[] = [
        ...messages,
        { role: "user", content },
      ];
      setMessages(next);
      setInput("");

      chat.mutate(
        { messages: next },
        {
          onSuccess: (res) => {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: res.reply },
            ]);
          },
          onError: (err) => {
            toast.error(err.message || "Κάτι πήγε στραβά. Δοκίμασε ξανά.");
            // Roll back the optimistic user turn so they can retry.
            setMessages((prev) => prev.slice(0, -1));
            setInput(content);
          },
        },
      );
    },
    [messages, chat],
  );

  const reset = () => {
    setMessages([]);
    setInput("");
  };

  const hasConversation = messages.length > 0;

  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <span
            className="flex items-center justify-center w-11 h-11 rounded-xl"
            style={{ background: `${ACCENT}26`, color: ACCENT }}
          >
            <Brain size={22} />
          </span>
          <div>
            <h1 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-bold text-white leading-tight">
              Mindset Coach
            </h1>
            <p className="text-sm text-[#A8B5C7] mt-0.5">
              Ο προσωπικός σου προπονητής ψυχολογίας trading.
            </p>
          </div>
        </div>
        {hasConversation && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[#7E8DA3] hover:text-white border border-white/8 hover:border-white/20 rounded-lg px-3 py-2 transition-colors"
          >
            <RotateCcw size={12} /> Νέα συζήτηση
          </button>
        )}
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-white/8 bg-[#0A1628]/40 p-4 sm:p-6 space-y-5"
      >
        {!hasConversation ? (
          <WelcomeCard onPick={send} />
        ) : (
          <>
            {messages.map((m, i) => (
              <MessageBubble key={i} msg={m} />
            ))}
            {chat.isPending && (
              <div className="flex gap-3">
                <div
                  className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg"
                  style={{ background: `${ACCENT}1A`, color: ACCENT }}
                >
                  <Brain size={16} />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-[#0D1E35]/80 border border-white/8">
                  <Loader2 className="animate-spin text-[#7E8DA3]" size={16} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-4"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[#0D1E35]/70 p-2 focus-within:border-white/25 transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Γράψε το μήνυμά σου..."
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-white placeholder:text-[#5A6B82] focus:outline-none max-h-40"
          />
          <button
            type="submit"
            disabled={!input.trim() || chat.isPending}
            className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ background: ACCENT }}
          >
            {chat.isPending ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-[#5A6B82] mt-2 text-center">
          {MINDSET_DISCLAIMER}
        </p>
      </form>
    </div>
  );
}
