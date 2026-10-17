import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

export default function NotFound() {
  const [, setLocation] = useLocation();
  const { lang } = useLanguage();
  const el = lang !== "en";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0A0A0B] px-6">
      <div className="text-center">
        <div className="font-display text-[clamp(80px,16vw,160px)] leading-none text-[#C9A24A]">
          404
        </div>
        <div className="mt-3 mb-8 h-px w-24 mx-auto bg-[rgba(201,162,74,0.30)]" />
        <p className="text-[16px] text-[#8E8A82] mb-8">
          {el ? "Η σελίδα δεν βρέθηκε." : "Page not found"}
        </p>
        <button
          onClick={() => setLocation("/")}
          className="btn-gold px-6 py-3 rounded-xl text-[15px] font-medium"
        >
          {el ? "Επιστροφή στην αρχική" : "Back to home"}
        </button>
      </div>
    </div>
  );
}
