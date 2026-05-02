import { useAuth } from "@/_core/hooks/useAuth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Bot,
  MessageCircle,
  Settings,
  Trophy,
  User,
  UtensilsCrossed,
} from "lucide-react";
import { useLocation } from "wouter";

const communityPaths = [
  "/feed",
  "/post/",
  "/restaurants",
  "/restaurant/",
  "/publish",
  "/submit-restaurant",
];

export function ResponsiveNav() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const mainNavItems = [
    { href: "/feed", label: t("nav.community"), icon: MessageCircle },
    { href: "/rankings", label: t("nav.rankings"), icon: Trophy },
    { href: "/ai-chat", label: t("nav.aiChat"), icon: Bot },
    { href: "/profile", label: t("nav.profile"), icon: User },
  ];

  const communityNavItems = [
    { href: "/feed", label: t("nav.discussion"), icon: MessageCircle },
    { href: "/restaurants", label: t("nav.restaurants"), icon: UtensilsCrossed },
  ];

  if (location === "/" || location.startsWith("/admin")) return null;

  const isCommunitySection = communityPaths.some((path) =>
    path.endsWith("/") ? location.startsWith(path) : location === path
  );

  const isMainActive = (href: string) => {
    if (href === "/feed") return isCommunitySection;
    return location === href;
  };

  const isCommunityActive = (href: string) => {
    if (href === "/feed") return location === "/feed" || location.startsWith("/post/");
    if (href === "/restaurants") {
      return location === "/restaurants" || location.startsWith("/restaurant/");
    }
    return location === href;
  };

  return (
    <>
      <nav className="sticky top-0 z-50 hidden border-b bg-white/90 shadow-sm backdrop-blur-md md:block">
        <div className="container flex h-14 items-center justify-between">
          <button
            onClick={() => navigate("/feed")}
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663506480782/XzEWDxgSS5RTJYj5etncA4/chileoma-logo-J5D7zC5YTWiDqDhd7fMXt5.webp"
              alt="吃了吗 Logo"
              className="h-8 w-8"
            />
            <span className="text-lg font-bold text-primary">吃了吗</span>
          </button>

          <div className="flex items-center gap-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const active = isMainActive(item.href);
              return (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                onClick={() => navigate("/admin")}
                size="sm"
                variant="outline"
              >
                <Settings className="h-4 w-4" />
                {t("nav.admin")}
              </Button>
            )}
            <LanguageSwitcher />
          </div>
        </div>
      </nav>

      {isCommunitySection && (
        <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-md md:top-14">
          <div className="container flex h-12 items-center justify-center gap-2 overflow-x-auto">
            {communityNavItems.map((item) => {
              const Icon = item.icon;
              const active = isCommunityActive(item.href);
              return (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 shadow-lg backdrop-blur-md md:hidden">
        <div className="grid h-16 grid-cols-4">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const active = isMainActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="h-16 md:hidden" />
      <div className="fixed right-3 top-3 z-50 md:hidden">
        <LanguageSwitcher compact />
      </div>
    </>
  );
}
