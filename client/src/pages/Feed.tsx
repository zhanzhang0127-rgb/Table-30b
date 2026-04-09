import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, MessageCircle, Share2, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { mockPosts } from "@/lib/mockData";

export default function Feed() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [offset, setOffset] = useState(0);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  // Use mock data for demo
  const [posts] = useState(mockPosts);
  const isLoading = false;

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
            <a href="/feed" className="text-foreground font-medium">首页</a>
            <a href="/restaurants" className="text-foreground/70 hover:text-foreground transition-colors">餐厅</a>
            <a href="/rankings" className="text-foreground/70 hover:text-foreground transition-colors">排行榜</a>
            <a href="/ai-chat" className="text-foreground/70 hover:text-foreground transition-colors">AI助手</a>
          </nav>

          <div className="flex items-center gap-3">
            <Button 
              size="sm"
              onClick={() => navigate("/publish")}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">发布</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/profile")}
            >
              {user?.name || "个人中心"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Posts Feed */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
            </div>
          ) : posts && posts.length > 0 ? (
            <>
              {posts.map((post) => (
                <Card key={post.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  {/* Post Header */}
                  <div className="p-6 border-b border-border">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">
                            {post.userName?.charAt(0) || "U"}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{post.userName}</p>
                          <p className="text-sm text-foreground/60">
                            {post.createdAt instanceof Date ? formatDistanceToNow(post.createdAt, { 
                              addSuffix: true,
                              locale: zhCN 
                            }) : "刚刚"}
                          </p>
                        </div>
                      </div>
                      {post.rating && (
                        <div className="flex items-center gap-1">
                          <span className="text-lg font-bold text-secondary">★</span>
                          <span className="font-semibold text-foreground">{post.rating}</span>
                        </div>
                      )}
                    </div>

                    {/* Post Title */}
                    <h3 className="text-lg font-bold text-foreground mb-2">{post.title}</h3>
                    <p className="text-foreground/70 line-clamp-3">{post.content}</p>
                  </div>

                  {/* Post Images */}
                  {post.images && (
                    <div className="bg-muted/30 p-4">
                      <div className="grid grid-cols-2 gap-2">
                        {JSON.parse(post.images || "[]").slice(0, 4).map((img: string, idx: number) => (
                          <img 
                            key={idx}
                            src={img} 
                            alt={`Post image ${idx + 1}`}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Post Actions */}
                  <div className="p-6 flex items-center justify-between border-t border-border">
                    <div className="flex items-center gap-6 text-foreground/60">
                      <button className="flex items-center gap-2 hover:text-primary transition-colors group">
                        <Heart className="w-5 h-5 group-hover:fill-current" />
                        <span className="text-sm">{post.likes}</span>
                      </button>
                      <button className="flex items-center gap-2 hover:text-primary transition-colors">
                        <MessageCircle className="w-5 h-5" />
                        <span className="text-sm">{post.comments}</span>
                      </button>
                      <button className="flex items-center gap-2 hover:text-primary transition-colors">
                        <Share2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Load More Button */}
              <div className="flex justify-center pt-4">
                <Button 
                  variant="outline"
                  onClick={() => setOffset(offset + 20)}
                >
                  加载更多
                </Button>
              </div>
            </>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-foreground/70 mb-4">暂无内容</p>
              <Button 
                onClick={() => navigate("/publish")}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                成为第一个分享者
              </Button>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
