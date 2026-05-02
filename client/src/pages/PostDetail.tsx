import { useAuth } from "@/_core/hooks/useAuth";
import { PostImageGrid } from "@/components/PostImageGrid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { hasMissingPostImages, parsePostImages } from "@/lib/postImages";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Heart,
  ImageOff,
  Loader2,
  MessageCircle,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { useLocation } from "wouter";
import { toast } from "sonner";

const formatRelativeTime = (value: unknown, language: "zh" | "en", fallback: string) => {
  if (!value) return fallback;
  return formatDistanceToNow(new Date(value as string), {
    addSuffix: true,
    locale: language === "zh" ? zhCN : enUS,
  });
};

export default function PostDetail() {
  const { user, loading, isAuthenticated } = useAuth();
  const { language, t } = useLanguage();
  const [, navigate] = useLocation();
  const [postId, setPostId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  useEffect(() => {
    const match = window.location.pathname.match(/\/post\/(\d+)/);
    if (match) {
      setPostId(parseInt(match[1], 10));
    }
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  const {
    data: post,
    isLoading: isLoadingPost,
    refetch: refetchPost,
  } = trpc.posts.getById.useQuery(postId || 0, {
    enabled: postId !== null && isAuthenticated,
  });

  const {
    data: comments,
    isLoading: isLoadingComments,
    refetch: refetchComments,
  } = trpc.comments.getByPostId.useQuery(
    { postId: postId || 0, limit: 50, offset: 0 },
    { enabled: postId !== null && isAuthenticated }
  );

  const { data: myLikedPosts } = trpc.likes.getMyLikedPosts.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const { data: myLikedComments } = trpc.likes.getMyLikedComments.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const likedPostsSet = new Set((myLikedPosts as number[]) || []);
  const likedCommentsSet = new Set((myLikedComments as number[]) || []);
  const utils = trpc.useUtils();

  const createCommentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setCommentText("");
      toast.success(t("postDetail.toastCommentSuccess"));
      refetchComments();
      refetchPost();
    },
    onError: (error) => {
      toast.error(t("postDetail.toastCommentFailed", { message: error.message }));
    },
  });

  const likePostMutation = trpc.likes.likePost.useMutation({
    onSuccess: () => {
      utils.likes.getMyLikedPosts.invalidate();
      refetchPost();
    },
    onError: (error) => {
      toast.error(t("feed.toastLikeFailed", { message: error.message }));
    },
  });

  const unlikePostMutation = trpc.likes.unlikePost.useMutation({
    onSuccess: () => {
      utils.likes.getMyLikedPosts.invalidate();
      refetchPost();
    },
    onError: (error) => {
      toast.error(t("feed.toastUnlikeFailed", { message: error.message }));
    },
  });

  const likeCommentMutation = trpc.comments.like.useMutation({
    onSuccess: () => {
      utils.likes.getMyLikedComments.invalidate();
      refetchComments();
    },
    onError: (error) => {
      toast.error(t("feed.toastLikeFailed", { message: error.message }));
    },
  });

  const unlikeCommentMutation = trpc.comments.unlike.useMutation({
    onSuccess: () => {
      utils.likes.getMyLikedComments.invalidate();
      refetchComments();
    },
    onError: (error) => {
      toast.error(t("feed.toastUnlikeFailed", { message: error.message }));
    },
  });

  const deleteCommentMutation = trpc.comments.delete.useMutation({
    onSuccess: () => {
      toast.success(t("postDetail.toastDeletedComment"));
      refetchComments();
      refetchPost();
    },
    onError: (error: any) => {
      if (error.code === "FORBIDDEN") {
        toast.error(t("postDetail.toastNoDeleteComment"));
      } else if (error.code === "NOT_FOUND") {
        toast.error(t("feed.toastNotFound"));
      } else {
        toast.error(t("feed.toastDeleteFailed", { message: error.message }));
      }
    },
  });

  const deletePostMutation = trpc.posts.delete.useMutation({
    onSuccess: () => {
      toast.success(t("feed.toastDeleted"));
      navigate("/feed");
    },
    onError: (error: any) => {
      if (error.code === "FORBIDDEN") {
        toast.error(t("feed.toastNoDeletePermission"));
      } else if (error.code === "NOT_FOUND") {
        toast.error(t("feed.toastNotFound"));
      } else {
        toast.error(t("feed.toastDeleteFailed", { message: error.message }));
      }
    },
  });

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !postId) {
      toast.error(t("postDetail.toastCommentRequired"));
      return;
    }

    setIsSubmittingComment(true);
    try {
      await createCommentMutation.mutateAsync({
        postId,
        content: commentText.trim(),
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleLikePost = () => {
    if (!postId || likePostMutation.isPending || unlikePostMutation.isPending) {
      return;
    }

    if (likedPostsSet.has(postId)) {
      unlikePostMutation.mutate(postId);
    } else {
      likePostMutation.mutate(postId);
    }
  };

  const handleLikeComment = (commentId: number) => {
    if (likeCommentMutation.isPending || unlikeCommentMutation.isPending) {
      return;
    }

    if (likedCommentsSet.has(commentId)) {
      unlikeCommentMutation.mutate(commentId);
    } else {
      likeCommentMutation.mutate(commentId);
    }
  };

  const handleDeleteComment = (commentId: number) => {
    if (confirm(t("postDetail.confirmDeleteComment"))) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  const handleDeletePost = () => {
    if (confirm(t("postDetail.confirmDeletePost")) && postId) {
      deletePostMutation.mutate(postId);
    }
  };

  if (loading || !isAuthenticated || !postId || isLoadingPost) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container py-8">
          <div className="mx-auto max-w-2xl rounded-lg border bg-card p-12 text-center shadow-sm">
            <p className="mb-4 text-muted-foreground">{t("postDetail.notFound")}</p>
            <Button onClick={() => navigate("/feed")}>{t("postDetail.back")}</Button>
          </div>
        </main>
      </div>
    );
  }

  const images = parsePostImages(post.images);
  const hasMissingImages = hasMissingPostImages(post.images);
  const isPostLiked = likedPostsSet.has(postId);
  const commentItems = (comments as any[]) || [];

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-5 sm:py-8">
        <div className="mx-auto max-w-6xl">
          <Button
            variant="ghost"
            className="mb-4 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={() => navigate("/feed")}
          >
            <ArrowLeft className="h-4 w-4" />
            {t("postDetail.back")}
          </Button>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <section className="min-w-0">
              <Card className="gap-0 overflow-hidden rounded-lg py-0 shadow-sm">
                <article>
                  <div className="border-b p-5 sm:p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-base font-semibold text-primary">
                          {post.userName?.charAt(0) || "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {post.userName || t("common.user")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatRelativeTime(post.createdAt, language, t("common.justNow"))}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {post.rating && (
                          <Badge variant="secondary">{t("common.rating")} {post.rating}</Badge>
                        )}
                        {user?.id === post.userId && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title={t("feed.deleteTitle")}
                            disabled={deletePostMutation.isPending}
                            onClick={handleDeletePost}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                      {post.title}
                    </h1>
                    {post.content && (
                      <p className="mt-4 whitespace-pre-wrap text-base leading-7 text-muted-foreground">
                        {post.content}
                      </p>
                    )}
                  </div>

                  {images.length > 0 && (
                    <div className="p-4 sm:p-6">
                      <PostImageGrid
                        images={images}
                        variant="detail"
                        onOpenImage={setEnlargedImage}
                      />
                    </div>
                  )}

                  {images.length === 0 && hasMissingImages && (
                    <div className="m-5 flex items-start gap-3 rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground sm:m-6">
                      <ImageOff className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">
                          {t("postDetail.badImagesTitle")}
                        </p>
                        <p className="mt-1">
                          {t("postDetail.badImagesBody")}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 border-t px-5 py-4 sm:px-6">
                    <Button
                      variant="ghost"
                      className={
                        isPostLiked
                          ? "text-destructive hover:text-destructive"
                          : "text-muted-foreground"
                      }
                      disabled={
                        likePostMutation.isPending ||
                        unlikePostMutation.isPending
                      }
                      onClick={handleLikePost}
                    >
                      <Heart
                        className="h-4 w-4"
                        fill={isPostLiked ? "currentColor" : "none"}
                      />
                      {post.likes || 0}
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() =>
                        document
                          .getElementById("comments-section")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                    >
                      <MessageCircle className="h-4 w-4" />
                      {post.comments || 0}
                    </Button>
                  </div>
                </article>
              </Card>
            </section>

            <aside id="comments-section" className="min-w-0">
              <Card className="gap-0 rounded-lg py-0 shadow-sm lg:sticky lg:top-20">
                <div className="border-b p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{t("postDetail.comments")}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {commentItems.length > 0
                          ? t("postDetail.discussions", { count: commentItems.length })
                          : t("postDetail.noComments")}
                      </p>
                    </div>
                    <Badge variant="outline">{post.comments || 0}</Badge>
                  </div>
                </div>

                <div className="border-b p-5">
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-semibold text-primary">
                      {user?.name?.charAt(0) || "U"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Textarea
                        placeholder={t("postDetail.placeholder")}
                        value={commentText}
                        onChange={(event) => setCommentText(event.target.value)}
                        rows={3}
                      />
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          onClick={handleSubmitComment}
                          disabled={isSubmittingComment || !commentText.trim()}
                        >
                          {isSubmittingComment ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          {t("postDetail.publish")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="max-h-[720px] overflow-y-auto p-5">
                  {isLoadingComments ? (
                    <div className="flex justify-center py-10">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
                    </div>
                  ) : commentItems.length > 0 ? (
                    <div className="space-y-5">
                      {commentItems.map((comment) => {
                        const isCommentLiked = likedCommentsSet.has(comment.id);
                        return (
                          <div key={comment.id} className="flex gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
                              {comment.userName?.charAt(0) || "U"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                  <p className="truncate text-sm font-semibold">
                                  {comment.userName || t("common.user")}
                                </p>
                                <span className="text-xs text-muted-foreground">
                                  {formatRelativeTime(comment.createdAt, language, t("common.justNow"))}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                                {comment.content}
                              </p>
                              <div className="mt-2 flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={
                                    isCommentLiked
                                      ? "h-7 px-2 text-destructive hover:text-destructive"
                                      : "h-7 px-2 text-muted-foreground"
                                  }
                                  disabled={
                                    likeCommentMutation.isPending ||
                                    unlikeCommentMutation.isPending
                                  }
                                  onClick={() => handleLikeComment(comment.id)}
                                >
                                  <Heart
                                    className="h-3.5 w-3.5"
                                    fill={
                                      isCommentLiked ? "currentColor" : "none"
                                    }
                                  />
                                  {comment.likes || 0}
                                </Button>
                                {user?.id === comment.userId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-muted-foreground"
                                    disabled={deleteCommentMutation.isPending}
                                    onClick={() =>
                                      handleDeleteComment(comment.id)
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {t("common.delete")}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-10 text-center">
                      <MessageCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {t("postDetail.emptyComments")}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </aside>
          </div>
        </div>
      </main>

      {enlargedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <Button
            variant="ghost"
            size="icon-lg"
            className="absolute right-4 top-4 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            onClick={(event) => {
              event.stopPropagation();
              setEnlargedImage(null);
            }}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={enlargedImage}
            alt={t("postDetail.enlargedAlt")}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
