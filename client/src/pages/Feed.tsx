import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";

export default function Feed() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [offset, setOffset] = useState(0);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  const [favoritePosts, setFavoritePosts] = useState<Set<number>>(new Set());

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  // Fetch posts
  const { data: postsData, isLoading } = trpc.posts.getFeed.useQuery(
    { limit: 20, offset },
    { enabled: isAuthenticated }
  );

  // Fetch user's favorites
  const { data: favorites } = trpc.favorites.getMyFavorites.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Initialize favorites set
  useEffect(() => {
    if (favorites) {
      const favoriteIds = new Set(favorites.map((f: any) => f.restaurantId));
      setFavoritePosts(favoriteIds);
    }
  }, [favorites]);

  // Update allPosts when new data arrives
  useEffect(() => {
    if (postsData) {
      if (offset === 0) {
        setAllPosts(postsData as any[]);
      } else {
        setAllPosts(prev => [...prev, ...(postsData as any[])]);
      }
    }
  }, [postsData, offset]);

  // Like post mutation
  const likePostMutation = trpc.likes.likePost.useMutation({
    onSuccess: (_, variables) => {
      setLikedPosts(prev => new Set(prev).add(variables));
      toast.success("已点赞");
    },
    onError: (error) => {
      toast.error("点赞失败：" + error.message);
    },
  });

  // Unlike post mutation
  const unlikePostMutation = trpc.likes.unlikePost.useMutation({
    onSuccess: (_, variables) => {
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables);
        return newSet;
      });
      toast.success("已取消点赞");
    },
    onError: (error) => {
      toast.error("取消点赞失败：" + error.message);
    },
  });

  // Add favorite mutation
  const addFavoriteMutation = trpc.favorites.add.useMutation({
    onSuccess: (_, variables) => {
      setFavoritePosts(prev => new Set(prev).add(variables));
      toast.success("已收藏");
    },
    onError: (error) => {
      toast.error("收藏失败：" + error.message);
    },
  });

  // Remove favorite mutation
  const removeFavoriteMutation = trpc.favorites.remove.useMutation({
    onSuccess: (_, variables) => {
      setFavoritePosts(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables);
        return newSet;
      });
      toast.success("已取消收藏");
    },
    onError: (error) => {
      toast.error("取消收藏失败：" + error.message);
    },
  });

  const handleLikePost = (postId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (likedPosts.has(postId)) {
      unlikePostMutation.mutate(postId);
    } else {
      likePostMutation.mutate(postId);
    }
  };

  const handleToggleFavorite = (restaurantId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (favoritePosts.has(restaurantId)) {
      removeFavoriteMutation.mutate(restaurantId);
    } else {
      addFavoriteMutation.mutate(restaurantId);
    }
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
            <a href="/feed" className="text-foreground font-medium">首页</a>
            <a href="/restaurants" className="text-foreground/70 hover:text-foreground transition-colors">餐厅</a>
            <a href="/rankings" className="text-foreground/70 hover:text-foreground transition-colors">排行榜</a>
            <a href="/ai-chat" className="text-foreground/70 hover:text-foreground transition-colors">AI助手</a>
          </nav>

          <div className="flex items-center gap-3">
            <Button 
              onClick={() => navigate("/publish")}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              + 发布
            </Button>
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
        <div className="max-w-2xl mx-auto space-y-6">
          {isLoading && offset === 0 ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
            </div>
          ) : allPosts && allPosts.length > 0 ? (
            <>
              {allPosts.map((post) => (
                <Card 
                  key={post.id} 
                  className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" 
                  onClick={() => navigate(`/post/${post.id}`)}
                >
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
                          <p className="font-semibold text-foreground">{post.userName || "用户"}</p>
                          <p className="text-sm text-foreground/60">
                            {post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { 
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
                        {(typeof post.images === 'string' ? JSON.parse(post.images || "[]") : post.images).slice(0, 4).map((img: string, idx: number) => (
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
                      <button 
                        onClick={(e) => handleLikePost(post.id, e)}
                        disabled={likePostMutation.isPending || unlikePostMutation.isPending}
                        className={`flex items-center gap-2 transition-colors group ${
                          likedPosts.has(post.id) ? "text-secondary" : "hover:text-primary"
                        }`}
                      >
                        <Heart 
                          className="w-5 h-5 group-hover:fill-current" 
                          fill={likedPosts.has(post.id) ? "currentColor" : "none"}
                        />
                        <span className="text-sm">{post.likes || 0}</span>
                      </button>
                      <button className="flex items-center gap-2 hover:text-primary transition-colors">
                        <MessageCircle className="w-5 h-5" />
                        <span className="text-sm">{post.comments || 0}</span>
                      </button>
                      <button 
                        onClick={(e) => handleToggleFavorite(post.restaurantId || post.id, e)}
                        disabled={addFavoriteMutation.isPending || removeFavoriteMutation.isPending}
                        className={`flex items-center gap-2 transition-colors ${
                          favoritePosts.has(post.restaurantId || post.id) ? "text-secondary" : "hover:text-primary"
                        }`}
                      >
                        <Bookmark 
                          className="w-5 h-5" 
                          fill={favoritePosts.has(post.restaurantId || post.id) ? "currentColor" : "none"}
                        />
                      </button>
                      <button className="flex items-center gap-2 hover:text-primary transition-colors">
                        <Share2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Load More Button */}
              {postsData && (postsData as any[]).length >= 20 && (
                <div className="flex justify-center pt-4">
                  <Button 
                    variant="outline"
                    onClick={() => setOffset(offset + 20)}
                    disabled={isLoading}
                  >
                    {isLoading ? "加载中..." : "加载更多"}
                  </Button>
                </div>
              )}
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
