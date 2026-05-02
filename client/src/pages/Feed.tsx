import { useAuth } from "@/_core/hooks/useAuth";
import { PostImageGrid } from "@/components/PostImageGrid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { hasMissingPostImages, parsePostImages } from "@/lib/postImages";
import { trpc } from "@/lib/trpc";
import { Heart, ImageOff, MessageCircle, Plus, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { useEffect, useState, type MouseEvent } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Feed() {
  const { isAuthenticated, loading, user } = useAuth();
  const { language, t } = useLanguage();
  const [, navigate] = useLocation();
  const [offset, setOffset] = useState(0);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/");
  }, [isAuthenticated, loading, navigate]);

  const { data: postsData, isLoading } = trpc.posts.getFeed.useQuery(
    { limit: 20, offset },
    { enabled: isAuthenticated }
  );

  const { data: myLikes } = trpc.likes.getMyLikedPosts.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (myLikes) setLikedPosts(new Set(myLikes as number[]));
  }, [myLikes]);

  useEffect(() => {
    if (!postsData) return;
    if (offset === 0) {
      setAllPosts(postsData as any[]);
    } else {
      setAllPosts((prev) => [...prev, ...(postsData as any[])]);
    }
  }, [postsData, offset]);

  const likePostMutation = trpc.likes.likePost.useMutation({
    onSuccess: (_, postId) => {
      setLikedPosts((prev) => new Set(prev).add(postId));
      setAllPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, likes: (post.likes || 0) + 1 } : post
        )
      );
    },
    onError: (error) => toast.error(t("feed.toastLikeFailed", { message: error.message })),
  });

  const unlikePostMutation = trpc.likes.unlikePost.useMutation({
    onSuccess: (_, postId) => {
      setLikedPosts((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
      setAllPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, likes: Math.max((post.likes || 0) - 1, 0) }
            : post
        )
      );
    },
    onError: (error) => toast.error(t("feed.toastUnlikeFailed", { message: error.message })),
  });

  const deletePostMutation = trpc.posts.delete.useMutation({
    onSuccess: (_, postId) => {
      setAllPosts((prev) => prev.filter((post) => post.id !== postId));
      toast.success(t("feed.toastDeleted"));
    },
    onError: (error: any) => {
      if (error.data?.code === "FORBIDDEN") {
        toast.error(t("feed.toastNoDeletePermission"));
      } else if (error.data?.code === "NOT_FOUND") {
        toast.error(t("feed.toastNotFound"));
      } else {
        toast.error(t("feed.toastDeleteFailed", { message: error.message }));
      }
    },
  });

  const handleLikePost = (postId: number, event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (likePostMutation.isPending || unlikePostMutation.isPending) return;

    if (likedPosts.has(postId)) {
      unlikePostMutation.mutate(postId);
    } else {
      likePostMutation.mutate(postId);
    }
  };

  const handleDeletePost = (
    postId: number,
    postUserId: number,
    event: MouseEvent
  ) => {
    event.stopPropagation();
    event.preventDefault();
    if (user?.id !== postUserId) {
      toast.error(t("feed.toastNoDeletePermission"));
      return;
    }
    if (confirm(t("feed.confirmDelete"))) deletePostMutation.mutate(postId);
  };

  const handleGoToComments = (postId: number, event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    navigate(`/post/${postId}`);
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-6 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <Badge variant="outline" className="mb-2 bg-card">
                {t("feed.badge")}
              </Badge>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {t("feed.title")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("feed.subtitle")}
              </p>
            </div>
            <Button
              className="shrink-0 whitespace-nowrap"
              onClick={() => navigate("/publish")}
            >
              <Plus className="h-4 w-4" />
              {t("feed.publish")}
            </Button>
          </div>

          {isLoading && offset === 0 ? (
            <div className="flex justify-center py-16">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            </div>
          ) : allPosts.length > 0 ? (
            <div className="space-y-4">
              {allPosts.map((post) => {
                const images = parsePostImages(post.images);
                const hasMissingImages = hasMissingPostImages(post.images);
                const isLiked = likedPosts.has(post.id);

                return (
                  <Card
                    key={post.id}
                    className="gap-0 overflow-hidden rounded-lg py-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    onClick={() => navigate(`/post/${post.id}`)}
                  >
                    <article className="cursor-pointer">
                      <div className="p-4 sm:p-5">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-semibold text-primary">
                              {post.userName?.charAt(0) || "U"}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold">
                                {post.userName || t("common.user")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {post.createdAt
                                  ? formatDistanceToNow(
                                      new Date(post.createdAt),
                                      {
                                        addSuffix: true,
                                        locale: language === "zh" ? zhCN : enUS,
                                      }
                                    )
                                  : t("common.justNow")}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {post.rating && (
                              <Badge variant="secondary">
                                {t("common.rating")} {post.rating}
                              </Badge>
                            )}
                            {user?.id === post.userId && (
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                title={t("feed.deleteTitle")}
                                disabled={deletePostMutation.isPending}
                                onClick={(event) =>
                                  handleDeletePost(
                                    post.id,
                                    post.userId,
                                    event
                                  )
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <h2 className="text-lg font-semibold leading-snug">
                          {post.title}
                        </h2>
                        {post.content && (
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                            {post.content}
                          </p>
                        )}
                      </div>

                      {images.length > 0 && (
                        <div className="px-4 pb-4 sm:px-5">
                          <PostImageGrid images={images} />
                        </div>
                      )}

                      {images.length === 0 && hasMissingImages && (
                        <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-3 text-sm text-muted-foreground sm:mx-5">
                          <ImageOff className="h-4 w-4 shrink-0" />
                          {t("feed.badImage")}
                        </div>
                      )}

                      <div className="flex items-center gap-2 border-t px-4 py-3 sm:px-5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={
                            isLiked
                              ? "text-destructive hover:text-destructive"
                              : "text-muted-foreground"
                          }
                          disabled={
                            likePostMutation.isPending ||
                            unlikePostMutation.isPending
                          }
                          onClick={(event) => handleLikePost(post.id, event)}
                        >
                          <Heart
                            className="h-4 w-4"
                            fill={isLiked ? "currentColor" : "none"}
                          />
                          {post.likes || 0}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={(event) =>
                            handleGoToComments(post.id, event)
                          }
                        >
                          <MessageCircle className="h-4 w-4" />
                          {post.comments || 0}
                        </Button>
                      </div>
                    </article>
                  </Card>
                );
              })}

              {postsData && (postsData as any[]).length >= 20 && (
                <div className="flex justify-center pt-2">
                  <Button
                    onClick={() => setOffset(offset + 20)}
                    disabled={isLoading}
                    variant="outline"
                  >
                    {t("feed.loadMore")}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-10 text-center shadow-sm">
              <p className="mb-4 text-muted-foreground">{t("feed.empty")}</p>
              <Button onClick={() => navigate("/publish")}>
                <Plus className="h-4 w-4" />
                {t("feed.publishFirst")}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
