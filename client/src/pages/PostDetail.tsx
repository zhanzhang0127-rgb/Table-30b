import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Share2, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";

export default function PostDetail() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [postId, setPostId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Extract postId from URL
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/post\/(\d+)/);
    if (match) {
      setPostId(parseInt(match[1], 10));
    }
  }, []);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  // Fetch post data
  const { data: post, isLoading: isLoadingPost } = trpc.posts.getById.useQuery(
    postId || 0,
    { enabled: postId !== null && isAuthenticated }
  );

  // Fetch comments
  const { data: comments, isLoading: isLoadingComments, refetch: refetchComments } = trpc.comments.getByPostId.useQuery(
    { postId: postId || 0, limit: 50, offset: 0 },
    { enabled: postId !== null && isAuthenticated }
  );

  // Create comment mutation
  const createCommentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setCommentText("");
      toast.success("评论成功！");
      refetchComments();
    },
    onError: (error) => {
      toast.error("评论失败：" + error.message);
    },
  });

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !postId) {
      toast.error("请输入评论内容");
      return;
    }

    setIsSubmittingComment(true);
    try {
      await createCommentMutation.mutateAsync({
        postId,
        content: commentText,
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (loading || !isAuthenticated || !postId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
      </div>
    );
  }

  if (isLoadingPost) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
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
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/feed")}
            >
              返回
            </Button>
          </div>
        </header>
        <main className="container py-8">
          <Card className="p-12 text-center">
            <p className="text-foreground/70">帖子不存在</p>
            <Button 
              onClick={() => navigate("/feed")}
              className="mt-4"
            >
              返回首页
            </Button>
          </Card>
        </main>
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
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate("/feed")}
          >
            返回
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Post Card */}
          <Card className="overflow-hidden">
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
              <h1 className="text-2xl font-bold text-foreground mb-2">{post.title}</h1>
              <p className="text-foreground/70">{post.content}</p>
            </div>

            {/* Post Images */}
            {post.images && (
              <div className="bg-muted/30 p-4">
                <div className="grid grid-cols-2 gap-2">
                  {(typeof post.images === 'string' ? JSON.parse(post.images || "[]") : post.images).map((img: string, idx: number) => (
                    <img 
                      key={idx}
                      src={img} 
                      alt={`Post image ${idx + 1}`}
                      className="w-full h-48 object-cover rounded-lg"
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
                  <span className="text-sm">{post.likes || 0}</span>
                </button>
                <button className="flex items-center gap-2 hover:text-primary transition-colors">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm">{post.comments || 0}</span>
                </button>
                <button className="flex items-center gap-2 hover:text-primary transition-colors">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </Card>

          {/* Comment Section */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">评论</h2>

            {/* Comment Input */}
            <div className="mb-6 pb-6 border-b border-border">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">
                    {user?.name?.charAt(0) || "U"}
                  </span>
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="写下你的评论..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="bg-muted/50 border-border mb-2"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSubmitComment}
                      disabled={isSubmittingComment || !commentText.trim()}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                    >
                      {isSubmittingComment && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isSubmittingComment ? "发布中..." : "发布"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Comments List */}
            {isLoadingComments ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-accent border-t-transparent"></div>
              </div>
            ) : comments && comments.length > 0 ? (
              <div className="space-y-4">
                {comments.map((comment: any) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {comment.userName?.charAt(0) || "U"}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-foreground text-sm">{comment.userName || "用户"}</p>
                        <p className="text-xs text-foreground/60">
                          {comment.createdAt ? formatDistanceToNow(new Date(comment.createdAt), { 
                            addSuffix: true,
                            locale: zhCN 
                          }) : "刚刚"}
                        </p>
                      </div>
                      <p className="text-foreground/70 text-sm">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-foreground/60 py-8">暂无评论，成为第一个评论者吧！</p>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
