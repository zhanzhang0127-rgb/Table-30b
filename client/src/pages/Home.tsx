import { useAuth } from "@/_core/hooks/useAuth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { Heart, MapPin, MessageCircle, Users, Utensils, Zap, AlertCircle, Info } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check for OAuth error in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error === 'invalid_email_domain') {
      setErrorMessage(t("home.errorInvalidEmail"));
    } else if (error === 'oauth_failed') {
      setErrorMessage(t("home.errorOauthFailed"));
    }
  }, [t]);

  // Auto-redirect authenticated users to feed
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/feed", { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
      </div>
    );
  }

  // Show login page for unauthenticated users
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="container flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-700 hover:text-red-900 transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <img 
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663506480782/XzEWDxgSS5RTJYj5etncA4/chileoma-logo-J5D7zC5YTWiDqDhd7fMXt5.webp" 
              alt="吃了吗 Logo" 
              className="h-10 w-10"
            />
            <span className="text-xl font-bold text-primary">吃了吗</span>
          </div>
          
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <a href={getLoginUrl()} className="text-sm text-foreground/70 hover:text-foreground transition-colors">
              {t("home.login")}
            </a>
            <Button 
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => window.location.href = getLoginUrl()}
            >
              {t("home.register")}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container py-16">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Hero */}
          <div className="text-center space-y-6">
            <div className="flex justify-center mb-6">
              <img 
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663506480782/XzEWDxgSS5RTJYj5etncA4/chileoma-logo-J5D7zC5YTWiDqDhd7fMXt5.webp" 
                alt="吃了吗" 
                className="h-24 w-24"
              />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground">
              {t("home.heroTitle")}
            </h1>
            <p className="text-xl text-foreground/70 max-w-2xl mx-auto">
              {t("home.heroSubtitle")}
            </p>
            
            {/* Login tip */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 max-w-lg mx-auto">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-left text-sm text-amber-800">
                  <p className="font-medium mb-1">{t("home.loginTipTitle")}</p>
                  <p>{t("home.loginTipBody")}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => window.location.href = getLoginUrl()}
              >
                {t("home.startNow")}
              </Button>
              <Button 
                size="lg"
                variant="outline"
              >
                {t("home.learnMore")}
              </Button>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <MessageCircle className="w-6 h-6 text-primary" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{t("home.featureShareTitle")}</h3>
              <p className="text-foreground/70">
                {t("home.featureShareBody")}
              </p>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-secondary/10 rounded-full">
                  <Zap className="w-6 h-6 text-secondary" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{t("home.featureAiTitle")}</h3>
              <p className="text-foreground/70">
                {t("home.featureAiBody")}
              </p>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-accent/10 rounded-full">
                  <MapPin className="w-6 h-6 text-accent" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{t("home.featureRankTitle")}</h3>
              <p className="text-foreground/70">
                {t("home.featureRankBody")}
              </p>
            </Card>
          </div>

          {/* CTA Section */}
          <Card className="p-12 bg-gradient-to-r from-primary/10 to-secondary/10 border-0 text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              {t("home.ctaTitle")}
            </h2>
            <p className="text-foreground/70 mb-6 max-w-xl mx-auto">
              {t("home.ctaBody")}
            </p>
            <Button 
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => window.location.href = getLoginUrl()}
            >
              {t("home.registerNow")}
            </Button>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16 py-8">
        <div className="container text-center text-foreground/60 text-sm">
          <p>{t("home.footer")}</p>
        </div>
      </footer>
    </div>
  );
}
