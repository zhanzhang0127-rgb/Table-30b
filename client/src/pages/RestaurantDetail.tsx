import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Star, MapPin, Phone, Clock, Heart, Share2, MessageCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { mockRestaurants } from "@/lib/mockData";

export default function RestaurantDetail() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [isFavorite, setIsFavorite] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // Get restaurant from URL params (simplified for demo)
  const restaurant = mockRestaurants[0];

  const comments = [
    {
      id: 1,
      author: "李明",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=1",
      rating: 5,
      date: "2024-03-28",
      text: "环境很舒适，菜品也很精致，强烈推荐！",
    },
    {
      id: 2,
      author: "王芳",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=2",
      rating: 4,
      date: "2024-03-25",
      text: "味道不错，就是有点小贵，不过值得。",
    },
    {
      id: 3,
      author: "张三",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=3",
      rating: 5,
      date: "2024-03-20",
      text: "服务员很热情，推荐他们的招牌菜！",
    },
  ];

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

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
              <button
                onClick={() => window.history.back()}
                className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>返回</span>
              </button>
          
          <span className="text-lg font-bold text-primary">餐厅详情</span>
          
          <div className="w-12"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Hero Image */}
          <div className="relative h-80 rounded-lg overflow-hidden shadow-lg">
            <img
              src={restaurant.image}
              alt={restaurant.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <h1 className="text-3xl font-bold mb-2">{restaurant.name}</h1>
              <p className="text-sm opacity-90">{restaurant.cuisine}</p>
            </div>
          </div>

          {/* Rating and Stats */}
          <Card className="p-6">
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-2xl font-bold text-foreground">
                    {parseFloat(restaurant.averageRating)}
                  </span>
                </div>
                <p className="text-xs text-foreground/60">{restaurant.totalRatings}条评价</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary mb-1">18</p>
                <p className="text-xs text-foreground/60">条评论</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-accent mb-1">342</p>
                <p className="text-xs text-foreground/60">人收藏</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setIsFavorite(!isFavorite)}
              >
                <Heart
                  className={`w-4 h-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
                />
                {isFavorite ? "已收藏" : "收藏"}
              </Button>
              <Button variant="outline" className="gap-2">
                <Share2 className="w-4 h-4" />
                分享
              </Button>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                <MessageCircle className="w-4 h-4" />
                评价
              </Button>
            </div>
          </Card>

          {/* Restaurant Info */}
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-foreground">餐厅信息</h2>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">地址</p>
                  <p className="text-sm text-foreground/70">{restaurant.address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">电话</p>
                  <p className="text-sm text-foreground/70">{restaurant.phone}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">营业时间</p>
                  <p className="text-sm text-foreground/70">10:00 - 22:00</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-sm text-foreground/70">{restaurant.description}</p>
            </div>
          </Card>

          {/* Comments Section */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">用户评价</h2>
              <button
                onClick={() => setShowComments(!showComments)}
                className="text-sm text-primary hover:underline"
              >
                {showComments ? "收起" : "展开"}
              </button>
            </div>

            <div className="space-y-4">
              {comments.slice(0, showComments ? comments.length : 2).map((comment) => (
                <div key={comment.id} className="pb-4 border-b border-border last:border-0">
                  <div className="flex items-start gap-3">
                    <img
                      src={comment.avatar}
                      alt={comment.author}
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-foreground">{comment.author}</p>
                        <span className="text-xs text-foreground/60">{comment.date}</span>
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < comment.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-foreground/70">{comment.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!showComments && comments.length > 2 && (
              <button
                onClick={() => setShowComments(true)}
                className="w-full mt-4 py-2 text-sm text-primary hover:bg-primary/10 rounded-md transition-colors"
              >
                查看全部 {comments.length} 条评价
              </button>
            )}
          </Card>

          {/* Similar Restaurants */}
          <Card className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">推荐餐厅</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockRestaurants.slice(1, 3).map((r) => (
                <div
                  key={r.id}
                  className="border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                >
                  <img
                    src={r.image}
                    alt={r.name}
                    className="w-full h-40 object-cover"
                  />
                  <div className="p-3">
                    <h3 className="font-medium text-foreground mb-1">{r.name}</h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-medium text-foreground">
                          {r.averageRating}
                        </span>
                      </div>
                      <span className="text-xs text-foreground/60">{r.cuisine}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
