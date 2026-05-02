import { useAuth } from "@/_core/hooks/useAuth";
import { isLocalPreviewHost } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { Mail, Phone, User, LogOut, Heart, FileText, MessageCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";

export default function Profile() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { language, t } = useLanguage();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [phone, setPhone] = useState("");
  const [wechatId, setWechatId] = useState("");
  const [qqId, setQqId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isLocalPreview = isLocalPreviewHost();
  const displayEmail =
    isLocalPreview && user?.email === "local-preview@localhost"
      ? t("profile.localPreviewAccount")
      : user?.email || t("profile.noEmail");

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  // Fetch user profile
  const { data: profile, isLoading: isLoadingProfile } = trpc.profile.getMe.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Fetch user's posts
  const { data: userPosts, isLoading: isLoadingPosts } = trpc.posts.getByUser.useQuery(
    { userId: user?.id || 0, limit: 100, offset: 0 },
    { enabled: isAuthenticated && user?.id !== undefined }
  );

  // Fetch user's liked posts with details
  const { data: likedPosts, isLoading: isLoadingLiked } = trpc.likes.getMyLikedPostsWithDetails.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Initialize form with profile data
  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
    if (profile) {
      setPhone(profile.phone || "");
      setWechatId(profile.wechatId || "");
      setQqId(profile.qqId || "");
    }
  }, [profile, user?.name]);

  const updateNameMutation = trpc.profile.updateName.useMutation({
    onSuccess: () => {
      toast.success(t("profile.toastNameUpdated"));
      setIsEditingName(false);
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(t("profile.toastUpdateFailed", { message: error.message }));
    },
  });

  const updateProfileMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success(t("profile.toastInfoUpdated"));
    },
    onError: (error) => {
      toast.error(t("profile.toastUpdateFailed", { message: error.message }));
    },
  });

  const handleSaveName = async () => {
    if (!name.trim()) {
      toast.error(t("profile.toastNameRequired"));
      return;
    }
    setIsSaving(true);
    try {
      await updateNameMutation.mutateAsync(name.trim());
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfileMutation.mutateAsync({
        phone: phone || undefined,
        wechatId: wechatId || undefined,
        qqId: qqId || undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
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
      {/* Main Content */}
      <main className="container py-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <Card className="p-8 mb-8">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-3xl font-bold text-primary">
                  {user?.name?.charAt(0) || "U"}
                </span>
              </div>
              <div className="flex-1">
                {isEditingName ? (
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("profile.editNamePlaceholder")}
                      maxLength={50}
                      className="text-lg font-bold"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveName}
                      disabled={isSaving}
                    >
                      {t("common.save")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditingName(false);
                        setName(user?.name || "");
                      }}
                      disabled={isSaving}
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-3xl font-bold text-foreground">{user?.name || t("common.user")}</h1>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingName(true)}
                    >
                      {t("common.edit")}
                    </Button>
                  </div>
                )}
                <p className="text-foreground/70">{displayEmail}</p>
              </div>
              <Button 
                variant="outline"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                {t("profile.logout")}
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-primary">{userPosts?.length || 0}</p>
                <p className="text-sm text-foreground/60">{t("profile.posts")}</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-primary">{likedPosts?.length || 0}</p>
                <p className="text-sm text-foreground/60">{t("profile.likes")}</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-primary">0</p>
                <p className="text-sm text-foreground/60">{t("profile.followers")}</p>
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">{t("profile.info")}</TabsTrigger>
              <TabsTrigger value="posts" className="gap-2">
                <FileText className="w-4 h-4" />
                {t("profile.myPosts")}
              </TabsTrigger>
              <TabsTrigger value="likes" className="gap-2">
                <Heart className="w-4 h-4" />
                {t("profile.myLikes")}
              </TabsTrigger>
            </TabsList>

            {/* Info Tab */}
            <TabsContent value="info" className="space-y-6">
              <Card className="p-6">
                <h2 className="text-xl font-bold text-foreground mb-6">{t("profile.contact")}</h2>
                
                {/* Email */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />
                    {t("profile.email")}
                  </label>
                  <Input
                    type="email"
                    value={displayEmail}
                    disabled
                    className="bg-muted/50 border-border"
                  />
                  <p className="text-xs text-foreground/60 mt-1">{t("profile.emailReadonly")}</p>
                </div>

                {/* Phone */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    <Phone className="w-4 h-4 inline mr-2" />
                    {t("profile.phone")}
                  </label>
                  <Input
                    type="tel"
                    placeholder={t("profile.phonePlaceholder")}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-muted/50 border-border"
                  />
                </div>

                {/* WeChat */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    {t("profile.wechat")}
                  </label>
                  <Input
                    placeholder={t("profile.wechatPlaceholder")}
                    value={wechatId}
                    onChange={(e) => setWechatId(e.target.value)}
                    className="bg-muted/50 border-border"
                  />
                </div>

                {/* QQ */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    {t("profile.qq")}
                  </label>
                  <Input
                    placeholder={t("profile.qqPlaceholder")}
                    value={qqId}
                    onChange={(e) => setQqId(e.target.value)}
                    className="bg-muted/50 border-border"
                  />
                </div>

                <Button 
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSaving ? t("profile.saving") : t("profile.saveInfo")}
                </Button>
              </Card>
            </TabsContent>

            {/* Posts Tab */}
            <TabsContent value="posts" className="space-y-4">
              {isLoadingPosts ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
                </div>
              ) : userPosts && userPosts.length > 0 ? (
                userPosts.map((post: any) => (
                  <Card 
                    key={post.id} 
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/post/${post.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-foreground">{post.title}</h3>
                        <p className="text-sm text-foreground/60 mt-1">
                          {formatDistanceToNow(new Date(post.createdAt), { 
                            addSuffix: true,
                            locale: language === "zh" ? zhCN : enUS
                          })}
                        </p>
                      </div>
                      {post.rating && (
                        <div className="flex items-center gap-1 ml-4">
                          <span className="text-lg font-bold text-secondary">★</span>
                          <span className="font-semibold text-foreground">{post.rating}</span>
                        </div>
                      )}
                    </div>
                    {post.content && (
                      <p className="text-foreground/70 line-clamp-2">{post.content}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-sm text-foreground/50">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5" /> {post.likes || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" /> {post.comments || 0}
                      </span>
                    </div>
                  </Card>
                ))
              ) : (
                <Card className="p-12 text-center">
                  <p className="text-foreground/70 mb-4">{t("profile.noPosts")}</p>
                  <Button 
                    onClick={() => navigate("/publish")}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {t("profile.goPublish")}
                  </Button>
                </Card>
              )}
            </TabsContent>

            {/* Likes Tab - 我的喜欢 */}
            <TabsContent value="likes" className="space-y-4">
              {isLoadingLiked ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
                </div>
              ) : likedPosts && likedPosts.length > 0 ? (
                likedPosts.map((post: any) => (
                  <Card 
                    key={post.id} 
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/post/${post.id}`)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Post thumbnail */}
                      {post.images && (() => {
                        try {
                          const imageList: string[] = typeof post.images === 'string' ? JSON.parse(post.images || "[]") : (Array.isArray(post.images) ? post.images : []);
                          if (imageList && imageList.length > 0) {
                            return (
                              <img 
                                src={imageList[0]} 
                                alt={post.title}
                                className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                              />
                            );
                          }
                        } catch {
                          // Ignore malformed image data
                        }
                        return null;
                      })()}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="text-lg font-bold text-foreground truncate">{post.title}</h3>
                          {post.rating && (
                            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                              <span className="text-lg font-bold text-secondary">★</span>
                              <span className="font-semibold text-foreground">{post.rating}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-foreground/60 mb-1">
                          {post.userName || t("common.user")} · {post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { 
                            addSuffix: true,
                            locale: language === "zh" ? zhCN : enUS
                          }) : ""}
                        </p>
                        {post.content && (
                          <p className="text-foreground/70 text-sm line-clamp-2">{post.content}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-foreground/50">
                          <span className="flex items-center gap-1">
                            <Heart className="w-3.5 h-3.5 text-red-400" fill="currentColor" /> {post.likes || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-3.5 h-3.5" /> {post.comments || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <Card className="p-12 text-center">
                  <Heart className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
                  <p className="text-foreground/70 mb-4">{t("profile.noLikes")}</p>
                  <Button 
                    onClick={() => navigate("/feed")}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {t("profile.goCommunity")}
                  </Button>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
