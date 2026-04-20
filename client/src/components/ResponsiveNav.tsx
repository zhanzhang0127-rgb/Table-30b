import { useLocation } from "wouter";
import { MessageCircle, Trophy, Bot, User, Plus, UtensilsCrossed } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function ResponsiveNav() {
  const [location, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();

  // Don't show nav on home/landing page
  if (location === "/") return null;

  const navItems = [
    { href: "/feed", label: "社区", icon: MessageCircle },
    { href: "/restaurants", label: "餐厅", icon: UtensilsCrossed },
    { href: "/rankings", label: "排行榜", icon: Trophy },
    { href: "/ai-chat", label: "AI助手", icon: Bot },
    { href: "/profile", label: "个人", icon: User },
  ];

  const isActive = (href: string) => {
    if (href === "/feed") {
      return location === "/feed" || location.startsWith("/post/");
    }
    if (href === "/restaurants") {
      return location === "/restaurants" || location.startsWith("/restaurant/");
    }
    return location === href;
  };

  return (
    <>
      {/* Desktop Top Navigation */}
      <nav className="hidden md:block sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border shadow-sm">
        <div className="container flex items-center justify-between h-14">
          {/* Logo */}
          <button
            onClick={() => navigate("/feed")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663506480782/XzEWDxgSS5RTJYj5etncA4/chileoma-logo-J5D7zC5YTWiDqDhd7fMXt5.webp"
              alt="吃了吗 Logo"
              className="h-8 w-8"
            />
            <span className="text-lg font-bold text-primary">吃了吗</span>
          </button>

          {/* Nav Items */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "text-primary bg-primary/10"
                      : "text-foreground/60 hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <Button
                onClick={() => navigate("/publish")}
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-1" />
                发布
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-border shadow-lg">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={`flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors ${
                  isActive(item.href)
                    ? "text-primary"
                    : "text-foreground/50 hover:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile bottom padding to avoid content overlap */}
      <div className="md:hidden h-16"></div>
    </>
  );
}
