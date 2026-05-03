import { useT } from "@/contexts/I18nContext";

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useT();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      className={`flex items-center gap-0.5 text-sm rounded-md px-2 py-1 border border-border hover:bg-muted/60 transition-colors ${className ?? ""}`}
      title="Switch language / 切换语言"
    >
      <span className={lang === "zh" ? "font-semibold text-primary" : "text-foreground/40"}>中</span>
      <span className="text-foreground/30 mx-0.5">/</span>
      <span className={lang === "en" ? "font-semibold text-primary" : "text-foreground/40"}>EN</span>
    </button>
  );
}
