import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Loader2, Trash2, X, ZoomIn } from "lucide-react";
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
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

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
  const { data: post, isLoading: isLoadingPost, refetch: refetchPost } = trpc.posts.getById.useQuery(
    postId || 0,
    { enabled: postId !== null && isAuthenticated }
  );

  // Fetch comments
  const { data: comments, isLoading: isLoadingComments, refetch: refetchComments } = trpc.comments.getByPostId.useQuery(
    { postId: postId || 0, limit: 50, offset: 0 },
    { enabled: postId !== null && isAuthenticated }
  );

  // Fetch user's liked posts from backend (persistent)
  const { data: myLikedPosts } = trpc.likes.getMyLikedPosts.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Fetch user's liked comments from backend (persistent)
  const { data: myLikedComments } = trpc.likes.getMyLikedComments.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const likedPostsSet = new Set(myLikedPosts as number[] || []);
  const likedCommentsSet = new Set(myLikedComments as number[] || []);

  // Create comment mutation
  const createCommentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setCommentText("");
      toast.success("评论成功！");
      refetchComments();
      refetchPost();
    },
    onError: (error) => {
      toast.error("评论失败：" + error.message);
    },
  });

  const utils = trpc.useUtils();

  // Like post mutation
  const likePostMutation = trpc.likes.likePost.useMutation({
    onSuccess: () => {
      utils.likes.getMyLikedPosts.invalidate();
      refetchPost();
    },
    onError: (error) => {
      toast.error("点赞失败：" + error.message);
    },
  });

  // Unlike post mutation
  const unlikePostMutation = trpc.likes.unlikePost.useMutation({
    onSuccess: () => {
      utils.likes.getMyLikedPosts.invalidate();
      refetchPost();
    },
    onError: (error) => {
      toast.error("取消点赞失败：" + error.message);
    },
  });

  // Like comment mutation
  const likeCommentMutation = trpc.comments.like.useMutation({
    onSuccess: () => {
      utils.likes.getMyLikedComments.invalidate();
      refetchComments();
    },
    onError: (error) => {
      toast.error("点赞失败：" + error.message);
    },
  });

  // Unlike comment mutation
  const unlikeCommentMutation = trpc.comments.unlike.useMutation({
    onSuccess: () => {
      utils.likes.getMyLikedComments.invalidate();
      refetchComments();
    },
    onError: (error) => {
      toast.error("取消点赞失败：" + error.message);
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = trpc.comments.delete.useMutation({
    onSuccess: () => {
      toast.success("评论已删除");
      refetchComments();
      refetchPost();
    },
    onError: (error: any) => {
      if (error.code === "FORBIDDEN") {
        toast.error("您没有权限删除这条评论");
      } else if (error.code === "NOT_FOUND") {
        toast.error("评论不存在");
      } else {
        toast.error("删除失败：" + error.message);
      }
    },
  });

  // Delete post mutation
  const deletePostMutation = trpc.posts.delete.useMutation({
    onSuccess: () => {
      toast.success("帖子已删除");
      navigate("/feed");
    },
    onError: (error: any) => {
      if (error.code === "FORBIDDEN") {
        toast.error("您没有权限删除这个帖子");
      } else if (error.code === "NOT_FOUND") {
        toast.error("帖子不存在");
      } else {
        toast.error("删除失败：" + error.message);
      }
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

  const handleLikePost = () => {
    if (!postId || likePostMutation.isPending || unlikePostMutation.isPending) return;
    if (likedPostsSet.has(postId)) {
      unlikePostMutation.mutate(postId);
    } else {
      likePostMutation.mutate(postId);
    }
  };

  const handleLikeComment = (commentId: number) => {
    if (likeCommentMutation.isPending || unlikeCommentMutation.isPending) return;
    if (likedCommentsSet.has(commentId)) {
      unlikeCommentMutation.mutate(commentId);
    } else {
      likeCommentMutation.mutate(commentId);
    }
  };

  const handleDeleteComment = (commentId: number) => {
    if (confirm("确定要删除这条评论吗？")) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  const handleDeletePost = () => {
    if (confirm("确定要删除这个帖子吗？")) {
      if (postId) {
        deletePostMutation.mutate(postId);
      }
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
        <main className="container py-8">
          <div className="max-w-2xl mx-auto">
            <Card className="p-12 text-center">
              <p className="text-foreground/70 mb-4">帖子不存在</p>
              <Button 
                onClick={() => navigate("/feed")}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                返回首页
              </Button>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
                <div className="flex items-center gap-2">
                  {post.rating && (
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-bold text-secondary">★</span>
                      <span className="font-semibold text-foreground">{post.rating}</span>
                    </div>
                  )}
                  {user?.id === post.userId && (
                    <button
                      onClick={handleDeletePost}
                      disabled={deletePostMutation.isPending}
                      className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                      title="删除帖子"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
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
                    <div key={idx} className="relative group cursor-pointer">
                      <img 
                        src={img} 
                        alt={`Post image ${idx + 1}`}
                        className="w-full h-48 object-cover rounded-lg"
                        onClick={() => setEnlargedImage(img)}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg transition-all flex items-center justify-center">
                        <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Image Lightbox */}
            {enlargedImage && (
              <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setEnlargedImage(null)}>
                <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                  <img src={enlargedImage} alt="Enlarged" className="w-full h-full object-contain rounded-lg" />
                  <button
                    onClick={() => setEnlargedImage(null)}
                    className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            )}

            {/* Post Actions */}
            <div className="p-6 flex items-center justify-between border-t border-border">
              <div className="flex items-center gap-6 text-foreground/60">
                <button 
                  onClick={handleLikePost}
                  disabled={likePostMutation.isPending || unlikePostMutation.isPending}
                  className={`flex items-center gap-2 transition-colors group ${
                    likedPostsSet.has(postId!) ? "text-secondary" : "hover:text-primary"
                  }`}
                  title="点赞"
                >
                  <Heart 
                    className="w-5 h-5 group-hover:fill-current" 
                    fill={likedPostsSet.has(postId!) ? "currentColor" : "none"}
                  />
                  <span className="text-sm">{post.likes || 0}</span>
                </button>
                <button 
                  onClick={() => {
                    const element = document.getElementById("comments-section");
                    element?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                  title="查看评论"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm">{post.comments || 0}</span>
                </button>
              </div>
            </div>
          </Card>

          {/* Comment Section */}
          <Card className="p-6" id="comments-section">
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
                  <div key={comment.id} className="flex gap-3 pb-4 border-b border-border last:border-b-0">
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
                      <p className="text-foreground/70 text-sm mb-2">{comment.content}</p>
                      
                      {/* Comment Actions */}
                      <div className="flex items-center gap-4 text-xs text-foreground/60">
                        <button 
                          onClick={() => handleLikeComment(comment.id)}
                          disabled={likeCommentMutation.isPending || unlikeCommentMutation.isPending}
                          className={`flex items-center gap-1 transition-colors ${
                            likedCommentsSet.has(comment.id) ? "text-secondary" : "hover:text-primary"
                          }`}
                        >
                          <Heart 
                            className="w-4 h-4" 
                            fill={likedCommentsSet.has(comment.id) ? "currentColor" : "none"}
                          />
                          <span>{comment.likes || 0}</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteComment(comment.id)}
                          disabled={deleteCommentMutation.isPending}
                          className="flex items-center gap-1 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>删除</span>
                        </button>
                      </div>
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
