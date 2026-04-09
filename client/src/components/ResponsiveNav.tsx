import { useLocation } from "wouter";
import { Home, MessageCircle, Trophy, Bot, User } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export function ResponsiveNav() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();

  const navItems = [
    { href: "/feed", label: "社区", icon: MessageCircle },
    { href: "/ai-chat", label: "AI", icon: Bot },
    { href: "/rankings", label: "排行榜", icon: Trophy },
    { href: "/profile", label: "个人", icon: User },
  ];

  const isActive = (href: string) => location === href;

  return (
    <>
      {/* Desktop Top Navigation */}
      <nav className="hidden md:block sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="container flex items-center justify-center h-14">
          <div className="flex items-center gap-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                    isActive(item.href)
                      ? "text-primary font-semibold bg-primary/10"
                      : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-border shadow-lg">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                  isActive(item.href)
                    ? "text-primary"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
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
