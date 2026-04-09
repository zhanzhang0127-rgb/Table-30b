import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trophy, MapPin, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { mockRankings, mockRestaurants } from "@/lib/mockData";

export default function Rankings() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [city, setCity] = useState("北京");
  const [searchCity, setSearchCity] = useState("北京");

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  // Use mock data for demo
  const [rankings] = useState(mockRankings);
  const isLoading = false;

  const handleSearch = () => {
    setSearchCity(city);
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="/feed" className="text-foreground/70 hover:text-foreground transition-colors">首页</a>
            <a href="/restaurants" className="text-foreground/70 hover:text-foreground transition-colors">餐厅</a>
            <a href="/rankings" className="text-foreground font-medium">排行榜</a>
            <a href="/ai-chat" className="text-foreground/70 hover:text-foreground transition-colors">AI助手</a>
          </nav>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/profile")}
            >
              个人中心
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
              <Trophy className="w-8 h-8 text-secondary" />
              地区排行榜
            </h1>
            <p className="text-foreground/70">
              发现你所在地区最受欢迎的餐厅，按评分和热度排序
            </p>
          </div>

          {/* Search Section */}
          <Card className="p-6 mb-8">
            <div className="flex gap-3">
              <Input
                placeholder="输入城市名称..."
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="flex-1 bg-muted/50 border-border"
              />
              <Button 
                onClick={handleSearch}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                搜索
              </Button>
            </div>
          </Card>

          {/* Rankings List */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
            </div>
          ) : rankings && rankings.length > 0 ? (
            <div className="space-y-4">
              {rankings.map((ranking, index) => (
                <Card key={ranking.id} className="p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-6">
                    {/* Rank Badge */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${
                      index === 0 ? "bg-yellow-100 text-yellow-700" :
                      index === 1 ? "bg-gray-100 text-gray-700" :
                      index === 2 ? "bg-orange-100 text-orange-700" :
                      "bg-primary/10 text-primary"
                    }`}>
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : ranking.rank}
                    </div>

                    {/* Restaurant Info */}
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-foreground mb-2">
                        {mockRestaurants.find(r => r.id === ranking.restaurantId)?.name || `餐厅 #${ranking.restaurantId}`}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-foreground/70">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{ranking.city}</span>
                          {ranking.district && <span>• {ranking.district}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-secondary" />
                        <span className="text-2xl font-bold text-foreground">
                          {ranking.score}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/60">综合评分</p>
                    </div>

                    {/* View Button */}
                    <Button 
                      variant="outline"
                      onClick={() => navigate("/restaurants")}
                      className="ml-4"
                    >
                      查看
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-foreground/70 mb-4">该城市暂无排行榜数据</p>
              <p className="text-sm text-foreground/60 mb-6">请尝试搜索其他城市或稍后再试</p>
              <Button 
                onClick={() => navigate("/restaurants")}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                浏览所有餐厅
              </Button>
            </Card>
          )}

          {/* Info Card */}
          <Card className="mt-8 p-6 bg-muted/30 border-0">
            <h3 className="font-semibold text-foreground mb-3">📊 排行榜说明</h3>
            <ul className="space-y-2 text-sm text-foreground/70">
              <li>• 排行榜每天更新一次，基于最新的用户评分和互动数据</li>
              <li>• 综合评分综合考虑餐厅评分、点赞数、评论数等多个因素</li>
              <li>• 🥇🥈🥉 分别代表该地区排名前三的餐厅</li>
              <li>• 点击"查看"按钮可以了解更多餐厅详情</li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}
