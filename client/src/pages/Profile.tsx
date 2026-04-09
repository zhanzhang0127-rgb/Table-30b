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
import { mockUserProfile, mockFavorites, mockPosts } from "@/lib/mockData";

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

  // Use mock data for demo
  const profile = mockUserProfile;
  const favorites = mockFavorites;
  const userPosts = mockPosts.filter(p => p.userId === user?.id);

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
                <h1 className="text-3xl font-bold text-foreground">{user?.name}</h1>
                <p className="text-foreground/70">用户ID: {user?.id}</p>
              </div>
              <Button 
                variant="destructive"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                退出登录
              </Button>
            </div>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="account" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="account">账号信息</TabsTrigger>
              <TabsTrigger value="favorites">我的收藏</TabsTrigger>
              <TabsTrigger value="posts">我的发布</TabsTrigger>
            </TabsList>

            {/* Account Tab */}
            <TabsContent value="account" className="space-y-6">
              <Card className="p-8">
                <h2 className="text-2xl font-bold text-foreground mb-6">账号信息</h2>

                {/* Email */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    邮箱
                  </label>
                  <Input
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted/50 border-border"
                  />
                  <p className="text-xs text-foreground/60 mt-1">邮箱已验证，无法修改</p>
                </div>

                {/* Phone */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    手机号
                  </label>
                  <Input
                    type="tel"
                    placeholder="输入你的手机号"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-muted/50 border-border"
                  />
                </div>

                {/* WeChat ID */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    微信ID
                  </label>
                  <Input
                    placeholder="输入你的微信ID"
                    value={wechatId}
                    onChange={(e) => setWechatId(e.target.value)}
                    className="bg-muted/50 border-border"
                  />
                </div>

                {/* QQ ID */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    QQ号
                  </label>
                  <Input
                    placeholder="输入你的QQ号"
                    value={qqId}
                    onChange={(e) => setQqId(e.target.value)}
                    className="bg-muted/50 border-border"
                  />
                </div>

                {/* Save Button */}
                <Button 
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSaving ? "保存中..." : "保存信息"}
                </Button>
              </Card>

              {/* Account Stats */}
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="p-6 text-center">
                  <p className="text-3xl font-bold text-primary mb-2">
                    {userPosts?.length || 0}
                  </p>
                  <p className="text-sm text-foreground/70">发布数</p>
                </Card>
                <Card className="p-6 text-center">
                  <p className="text-3xl font-bold text-secondary mb-2">
                    {favorites?.length || 0}
                  </p>
                  <p className="text-sm text-foreground/70">收藏数</p>
                </Card>
                <Card className="p-6 text-center">
                  <p className="text-3xl font-bold text-accent mb-2">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                  </p>
                  <p className="text-sm text-foreground/70">加入时间</p>
                </Card>
              </div>
            </TabsContent>

            {/* Favorites Tab */}
            <TabsContent value="favorites">
              <Card className="p-8">
                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                  <Heart className="w-6 h-6 text-secondary" />
                  我的收藏
                </h2>

                {favorites && favorites.length > 0 ? (
                  <div className="space-y-4">
                    {favorites.map((fav) => {
                      const restaurant = mockPosts.find(p => p.restaurantId === fav.restaurantId);
                      return (
                      <div key={fav.id} className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors">
                        <p className="font-semibold text-foreground">
                          {restaurant ? restaurant.title : `餐厅 #${fav.restaurantId}`}
                        </p>
                        <p className="text-sm text-foreground/70 mt-1">
                          收藏于 {new Date(fav.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-foreground/70 mb-4">还没有收藏任何餐厅</p>
                    <Button 
                      onClick={() => navigate("/restaurants")}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      去浏览餐厅
                    </Button>
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Posts Tab */}
            <TabsContent value="posts">
              <Card className="p-8">
                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-primary" />
                  我的发布
                </h2>

                {userPosts && userPosts.length > 0 ? (
                  <div className="space-y-4">
                    {userPosts.map((post) => (
                      <div key={post.id} className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors">
                        <h3 className="font-semibold text-foreground">{post.title}</h3>
                        <p className="text-sm text-foreground/70 mt-1 line-clamp-2">{post.content}</p>
                        <div className="flex items-center gap-4 mt-3 text-sm text-foreground/60">
                          <span>❤️ {post.likes}</span>
                          <span>💬 {post.comments}</span>
                          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-foreground/70 mb-4">还没有发布过内容</p>
                    <Button 
                      onClick={() => navigate("/publish")}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      去发布
                    </Button>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
