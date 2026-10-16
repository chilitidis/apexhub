/**
 * ComingSoon — placeholder used by sidebar items whose dedicated view is not
 * yet implemented. Keeps the navigation structure honest (the user can see
 * what's coming) without forcing us to ship empty pages.
 */
import { Hourglass } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description?: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div
      data-testid={`coming-soon-${title.toLowerCase().replace(/\s+/g, "-")}`}
      className="min-h-[60vh] flex items-center justify-center px-6"
    >
      <div className="max-w-md w-full bg-[#121214]/60 border border-white/10 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[#C9A24A]/15 border border-[#C9A24A]/30 flex items-center justify-center mx-auto mb-4">
          <Hourglass size={20} className="text-[#E6C873]" />
        </div>
        <div className="font-['Inter'] text-xl font-semibold text-white mb-2">
          {title}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#C9A24A] mb-3">
          Coming Soon
        </div>
        <div className="text-sm text-[#B5B0A6] leading-relaxed">
          {description ??
            "We're building this section. It'll appear here as soon as it's ready — no extra setup needed on your side."}
        </div>
      </div>
    </div>
  );
}

export default ComingSoon;
