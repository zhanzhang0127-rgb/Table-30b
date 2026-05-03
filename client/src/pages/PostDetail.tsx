import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Loader2, Trash2, X, ZoomIn, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";
import { useT } from "@/contexts/I18nContext";

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
  const { t, lang } = useT();

  const createCommentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setCommentText("");
      toast.success(t('toast.commentSuccess'));
      refetchComments();
      refetchPost();
    },
    onError: (error) => {
      toast.error(t('toast.commentFailed', { error: error.message }));
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
      toast.error(t('toast.likeFailed', { error: error.message }));
    },
  });

  // Unlike post mutation
  const unlikePostMutation = trpc.likes.unlikePost.useMutation({
    onSuccess: () => {
      utils.likes.getMyLikedPosts.invalidate();
      refetchPost();
    },
    onError: (error) => {
      toast.error(t('toast.unlikeFailed', { error: error.message }));
    },
  });

  // Like comment mutation
  const likeCommentMutation = trpc.comments.like.useMutation({
    onSuccess: () => {
      utils.likes.getMyLikedComments.invalidate();
      refetchComments();
    },
    onError: () => {
      toast.error(t('toast.likeCommentFailed'));
    },
  });

  // Unlike comment mutation
  const unlikeCommentMutation = trpc.comments.unlike.useMutation({
    onSuccess: () => {
      utils.likes.getMyLikedComments.invalidate();
      refetchComments();
    },
    onError: () => {
      toast.error(t('toast.unlikeCommentFailed'));
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = trpc.comments.delete.useMutation({
    onSuccess: () => {
      toast.success(t('toast.commentDeleted'));
      refetchComments();
      refetchPost();
    },
    onError: (error: any) => {
      toast.error(t('toast.deleteFailed', { error: error.message }));
    },
  });

  // Delete post mutation
  const deletePostMutation = trpc.posts.delete.useMutation({
    onSuccess: () => {
      toast.success(t('toast.postDeleted'));
      navigate("/feed");
    },
    onError: (error: any) => {
      if (error.data?.code === "FORBIDDEN") {
        toast.error(t('toast.noPermission'));
      } else if (error.data?.code === "NOT_FOUND") {
        toast.error(t('toast.postNotFound'));
      } else {
        toast.error(t('toast.deleteFailed', { error: error.message }));
      }
    },
  });

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !postId) return;

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
    if (confirm(lang === 'en' ? 'Delete this comment?' : '确定要删除这条评论吗？')) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  const handleDeletePost = () => {
    if (confirm(lang === 'en' ? 'Delete this post?' : '确定要删除这个帖子吗？')) {
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
              <p className="text-foreground/70 mb-4">{t('postDetail.notFound')}</p>
              <Button
                onClick={() => navigate("/feed")}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {t('postDetail.backToFeed')}
              </Button>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const normalizeRating = (value: number) => Math.max(1, Math.min(5, Math.round(value)));
  const renderStars = (value: number) => {
    const safe = normalizeRating(value);
    return `${"★".repeat(safe)}${"☆".repeat(5 - safe)}`;
  };
  const hasDualRatings = typeof post.tasteRating === "number" && typeof post.valueRating === "number";
  const postTypeBadge = post.postType === "delivery"
    ? t('postDetail.delivery')
    : post.postType === "dine-in"
    ? t('postDetail.dineIn')
    : "📝";

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <main className="container py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Back Button */}
          <button
            onClick={() => navigate("/feed")}
            className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">{t('postDetail.backToFeed')}</span>
          </button>
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
                  {user?.id === post.userId && (
                    <button
                      onClick={handleDeletePost}
                      disabled={deletePostMutation.isPending}
                      className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                      title={t('postDetail.deletePost')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Post Title */}
              <h1 className="text-2xl font-bold text-foreground mb-2">{post.title}</h1>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground/80">
                  {postTypeBadge}
                </span>
              </div>
              {hasDualRatings ? (
                <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-foreground/75">
                  <span>{t('postDetail.tasteRating')} {renderStars(post.tasteRating!)} ({post.tasteRating})</span>
                  <span>{t('postDetail.valueRating')} {renderStars(post.valueRating!)} ({post.valueRating})</span>
                </div>
              ) : post.rating ? (
                <div className="mb-2 text-sm text-foreground/75">★ {post.rating}</div>
              ) : null}
              {post.postType === "dine-in" && post.location && (
                <p className="mb-2 text-sm text-foreground/70">📍 {post.location}</p>
              )}
              <p className="text-foreground/70">{post.content}</p>
            </div>

            {/* Post Images */}
            {post.images && (() => {
              const imageList: string[] = typeof post.images === 'string' ? JSON.parse(post.images || "[]") : post.images;
              if (!imageList || imageList.length === 0) return null;
              return (
                <div className="bg-muted/30 p-4">
                  <div className={`grid gap-2 ${imageList.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {imageList.map((img: string, idx: number) => (
                      <div 
                        key={idx} 
                        className="relative group cursor-pointer overflow-hidden rounded-lg"
                        onClick={() => setEnlargedImage(img)}
                      >
                        <img 
                          src={img} 
                          alt={`帖子图片 ${idx + 1}`}
                          className={`w-full object-cover rounded-lg transition-transform duration-200 group-hover:scale-105 ${imageList.length === 1 ? 'max-h-96' : 'h-48'}`}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-all flex items-center justify-center">
                          <div className="bg-black/50 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ZoomIn className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          点击放大
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Image Lightbox - Full Screen */}
            {enlargedImage && (
              <div 
                className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center"
                onClick={() => setEnlargedImage(null)}
              >
                {/* Close button */}
                <button
                  onClick={(e) => { e.stopPropagation(); setEnlargedImage(null); }}
                  className="absolute top-4 right-4 z-[101] bg-white/20 hover:bg-white/40 text-white rounded-full p-3 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                {/* Hint text */}
                <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-sm z-[101]">点击任意位置关闭</p>
                {/* Image container */}
                <div 
                  className="w-full h-full flex items-center justify-center p-4 sm:p-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img 
                    src={enlargedImage} 
                    alt="放大图片" 
                    className="max-w-full max-h-full object-contain select-none"
                    onClick={() => setEnlargedImage(null)}
                  />
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
                  title={t('postDetail.commentsTitle')}
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm">{post.comments || 0}</span>
                </button>
              </div>
            </div>
          </Card>

          {/* Comment Section */}
          <Card className="p-6" id="comments-section">
            <h2 className="text-lg font-bold text-foreground mb-4">{t('postDetail.commentsTitle')}</h2>

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
                    placeholder={t('postDetail.commentPlaceholder')}
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
                      {t('postDetail.commentSend')}
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
              <p className="text-center text-foreground/60 py-8">{t('postDetail.noComments')}</p>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
