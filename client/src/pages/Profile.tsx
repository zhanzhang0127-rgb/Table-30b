import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, User, LogOut, Heart, FileText } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function Profile() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const [phone, setPhone] = useState("");
  const [wechatId, setWechatId] = useState("");
  const [qqId, setQqId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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

  // Fetch user's favorites
  const { data: favorites, isLoading: isLoadingFavorites } = trpc.favorites.getMyFavorites.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setPhone(profile.phone || "");
      setWechatId(profile.wechatId || "");
      setQqId(profile.qqId || "");
    }
  }, [profile]);

  const updateProfileMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("个人信息已更新");
    },
    onError: (error) => {
      toast.error("更新失败：" + error.message);
    },
  });

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
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/feed")}
            >
              返回首页
            </Button>
          </div>
        </div>
      </header>

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
                <h1 className="text-3xl font-bold text-foreground mb-2">{user?.name || "用户"}</h1>
                <p className="text-foreground/70">{user?.email || "未绑定邮箱"}</p>
              </div>
              <Button 
                variant="outline"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                退出登录
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-primary">{userPosts?.length || 0}</p>
                <p className="text-sm text-foreground/60">发布</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-primary">{favorites?.length || 0}</p>
                <p className="text-sm text-foreground/60">收藏</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-primary">0</p>
                <p className="text-sm text-foreground/60">粉丝</p>
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">个人信息</TabsTrigger>
              <TabsTrigger value="posts" className="gap-2">
                <FileText className="w-4 h-4" />
                我的发布
              </TabsTrigger>
              <TabsTrigger value="favorites" className="gap-2">
                <Heart className="w-4 h-4" />
                我的收藏
              </TabsTrigger>
            </TabsList>

            {/* Info Tab */}
            <TabsContent value="info" className="space-y-6">
              <Card className="p-6">
                <h2 className="text-xl font-bold text-foreground mb-6">联系信息</h2>
                
                {/* Email */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />
                    邮箱
                  </label>
                  <Input
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted/50 border-border"
                  />
                  <p className="text-xs text-foreground/60 mt-1">邮箱不可修改</p>
                </div>

                {/* Phone */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    <Phone className="w-4 h-4 inline mr-2" />
                    手机号
                  </label>
                  <Input
                    type="tel"
                    placeholder="输入手机号"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-muted/50 border-border"
                  />
                </div>

                {/* WeChat */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    微信号
                  </label>
                  <Input
                    placeholder="输入微信号"
                    value={wechatId}
                    onChange={(e) => setWechatId(e.target.value)}
                    className="bg-muted/50 border-border"
                  />
                </div>

                {/* QQ */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    QQ号
                  </label>
                  <Input
                    placeholder="输入QQ号"
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
                  {isSaving ? "保存中..." : "保存信息"}
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
                            locale: zhCN 
                          })}
                        </p>
                      </div>
                      {post.rating && (
                        <div className="flex items-center gap-1">
                          <span className="text-lg font-bold text-secondary">★</span>
                          <span className="font-semibold text-foreground">{post.rating}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-foreground/70 line-clamp-2">{post.content}</p>
                  </Card>
                ))
              ) : (
                <Card className="p-12 text-center">
                  <p className="text-foreground/70 mb-4">还没有发布过内容</p>
                  <Button 
                    onClick={() => navigate("/publish")}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    去发布
                  </Button>
                </Card>
              )}
            </TabsContent>

            {/* Favorites Tab */}
            <TabsContent value="favorites" className="space-y-4">
              {isLoadingFavorites ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
                </div>
              ) : favorites && favorites.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {favorites.map((favorite: any) => (
                    <Card 
                      key={favorite.id} 
                      className="p-6 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/restaurant/${favorite.restaurantId}`)}
                    >
                      <h3 className="text-lg font-bold text-foreground mb-2">餐厅 #{favorite.restaurantId}</h3>
                      <p className="text-sm text-foreground/60">
                        已收藏
                      </p>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <p className="text-foreground/70 mb-4">还没有收藏过餐厅</p>
                  <Button 
                    onClick={() => navigate("/restaurants")}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    去浏览餐厅
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
