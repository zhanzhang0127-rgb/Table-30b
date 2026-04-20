import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";

export default function Feed() {
  const { isAuthenticated, loading, user } = useAuth();
  const [, navigate] = useLocation();
  const [offset, setOffset] = useState(0);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());

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

  // Fetch user's liked posts from backend
  const { data: myLikes } = trpc.likes.getMyLikedPosts.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Initialize liked posts from backend
  useEffect(() => {
    if (myLikes) {
      setLikedPosts(new Set(myLikes as number[]));
    }
  }, [myLikes]);

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
      // Update post likes count in local state
      setAllPosts(prev => prev.map(p => 
        p.id === variables ? { ...p, likes: (p.likes || 0) + 1 } : p
      ));
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
      // Update post likes count in local state
      setAllPosts(prev => prev.map(p => 
        p.id === variables ? { ...p, likes: Math.max((p.likes || 0) - 1, 0) } : p
      ));
    },
    onError: (error) => {
      toast.error("取消点赞失败：" + error.message);
    },
  });

  // Delete post mutation
  const deletePostMutation = trpc.posts.delete.useMutation({
    onSuccess: (_, variables) => {
      setAllPosts(prev => prev.filter(p => p.id !== variables));
      toast.success("帖子已删除");
    },
    onError: (error: any) => {
      if (error.data?.code === "FORBIDDEN") {
        toast.error("您没有权限删除这个帖子");
      } else if (error.data?.code === "NOT_FOUND") {
        toast.error("帖子不存在");
      } else {
        toast.error("删除失败：" + error.message);
      }
    },
  });

  const handleLikePost = (postId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (likePostMutation.isPending || unlikePostMutation.isPending) return;
    if (likedPosts.has(postId)) {
      unlikePostMutation.mutate(postId);
    } else {
      likePostMutation.mutate(postId);
    }
  };

  const handleDeletePost = (postId: number, userId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (user?.id !== userId) {
      toast.error("您没有权限删除这个帖子");
      return;
    }
    if (confirm("确定要删除这个帖子吗？")) {
      deletePostMutation.mutate(postId);
    }
  };

  const handleGoToComments = (postId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigate(`/post/${postId}`);
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
      {/* Main Content - no header, using global ResponsiveNav */}
      <main className="container py-6">
        <div className="max-w-2xl mx-auto space-y-4">
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
                  <div className="p-4 pb-2">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">
                            {post.userName?.charAt(0) || "U"}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{post.userName || "用户"}</p>
                          <p className="text-xs text-foreground/50">
                            {post.createdAt ? formatDistanceToNow(new Date(post.createdAt), {
                              addSuffix: true,
                              locale: zhCN
                            }) : "刚刚"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {post.rating && (
                          <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full">
                            <span className="text-sm font-bold text-amber-500">★</span>
                            <span className="text-sm font-semibold text-amber-700">{post.rating}</span>
                          </div>
                        )}
                        {user?.id === post.userId && (
                          <button
                            onClick={(e) => handleDeletePost(post.id, post.userId, e)}
                            disabled={deletePostMutation.isPending}
                            className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors text-foreground/40"
                            title="删除帖子"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Post Content */}
                    <h3 className="text-base font-bold text-foreground mb-1">{post.title}</h3>
                    <p className="text-sm text-foreground/70 line-clamp-3">{post.content}</p>
                  </div>

                  {/* Post Images */}
                  {post.images && (() => {
                    const imgs = typeof post.images === 'string' ? JSON.parse(post.images || "[]") : post.images;
                    return imgs.length > 0 ? (
                      <div className="px-4 py-2">
                        <div className={`grid gap-2 ${imgs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          {imgs.slice(0, 4).map((img: string, idx: number) => (
                            <img
                              key={idx}
                              src={img}
                              alt={`图片 ${idx + 1}`}
                              className={`w-full object-cover rounded-lg ${imgs.length === 1 ? 'h-64' : 'h-32'}`}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Post Actions - only like and comment, no bookmark/share */}
                  <div className="px-4 py-3 flex items-center gap-6 border-t border-border/50">
                    <button
                      onClick={(e) => handleLikePost(post.id, e)}
                      disabled={likePostMutation.isPending || unlikePostMutation.isPending}
                      className={`flex items-center gap-1.5 text-sm transition-colors ${
                        likedPosts.has(post.id)
                          ? "text-red-500"
                          : "text-foreground/50 hover:text-red-500"
                      }`}
                    >
                      <Heart
                        className="w-[18px] h-[18px]"
                        fill={likedPosts.has(post.id) ? "currentColor" : "none"}
                      />
                      <span>{post.likes || 0}</span>
                    </button>
                    <button
                      onClick={(e) => handleGoToComments(post.id, e)}
                      className="flex items-center gap-1.5 text-sm text-foreground/50 hover:text-primary transition-colors"
                    >
                      <MessageCircle className="w-[18px] h-[18px]" />
                      <span>{post.comments || 0}</span>
                    </button>
                  </div>
                </Card>
              ))}

              {/* Load More Button */}
              {postsData && (postsData as any[]).length >= 20 && (
                <div className="flex justify-center pt-4">
                  <Button
                    onClick={() => setOffset(offset + 20)}
                    disabled={isLoading}
                    variant="outline"
                  >
                    加载更多
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-foreground/60 mb-4">暂无帖子</p>
              <Button onClick={() => navigate("/publish")} className="bg-primary text-primary-foreground">
                发布第一条帖子
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
