import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, MapPin, MessageCircle, Users, Utensils, Zap, AlertCircle } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check for OAuth error in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error === 'invalid_email_domain') {
      setErrorMessage('注册失败：只允许使用 @student.xjtlu.edu.cn 邮箱地址注册。请使用你的大学邮箱重新注册。');
    } else if (error === 'oauth_failed') {
      setErrorMessage('注册失败：OAuth认证失败，请稍后重试。');
    }
  }, []);

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
            <a href={getLoginUrl()} className="text-sm text-foreground/70 hover:text-foreground transition-colors">
              登录
            </a>
            <Button 
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => window.location.href = getLoginUrl()}
            >
              注册
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
              吃了吗？
            </h1>
            <p className="text-xl text-foreground/70 max-w-2xl mx-auto">
              发现美食，分享快乐。与朋友一起探索城市最好的餐厅，分享你的美食故事。
            </p>
            <p className="text-sm text-foreground/50">
              💡 仅限西交利物浦大学学生使用（需要 @student.xjtlu.edu.cn 邮箱）
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => window.location.href = getLoginUrl()}
              >
                立即开始
              </Button>
              <Button 
                size="lg"
                variant="outline"
              >
                了解更多
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
              <h3 className="text-lg font-bold text-foreground mb-2">分享美食</h3>
              <p className="text-foreground/70">
                发布你的美食照片和评价，与社区分享你的发现。
              </p>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-secondary/10 rounded-full">
                  <Zap className="w-6 h-6 text-secondary" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">AI推荐</h3>
              <p className="text-foreground/70">
                告诉AI你的口味偏好，获得智能推荐的餐厅。
              </p>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-accent/10 rounded-full">
                  <MapPin className="w-6 h-6 text-accent" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">发现排行榜</h3>
              <p className="text-foreground/70">
                浏览你所在地区最受欢迎的餐厅排行榜。
              </p>
            </Card>
          </div>

          {/* CTA Section */}
          <Card className="p-12 bg-gradient-to-r from-primary/10 to-secondary/10 border-0 text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              准备好了吗？
            </h2>
            <p className="text-foreground/70 mb-6 max-w-xl mx-auto">
              加入吃了吗社区，发现美食，分享快乐，与美食爱好者一起探索城市的每一个角落。
            </p>
            <Button 
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => window.location.href = getLoginUrl()}
            >
              现在注册
            </Button>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16 py-8">
        <div className="container text-center text-foreground/60 text-sm">
          <p>© 2024 吃了吗 - 美食分享与餐厅推荐平台</p>
        </div>
      </footer>
    </div>
  );
}
