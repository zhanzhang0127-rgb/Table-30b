import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggleLanguage}
      title={t("language.switch")}
      aria-label={t("language.switch")}
      className="gap-1.5 bg-white/80"
    >
      <Languages className="h-4 w-4" />
      <span className={compact ? "sr-only" : "text-xs font-semibold"}>
        <span className={language === "zh" ? "text-primary" : "text-muted-foreground"}>
          中
        </span>
        <span className="px-1 text-muted-foreground">/</span>
        <span className={language === "en" ? "text-primary" : "text-muted-foreground"}>
          EN
        </span>
      </span>
    </Button>
  );
}
