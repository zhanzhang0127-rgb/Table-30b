import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Users,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  Store,
  FileText,
  Clock,
  Image,
  ArrowLeft,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

type AdminTab = "overview" | "restaurants" | "users" | "admins";

function PromoteUserForm({ onPromote, isPending }: { onPromote: (userId: number) => void; isPending: boolean }) {
  const [inputId, setInputId] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        type="number"
        placeholder="输入用户 ID"
        value={inputId}
        onChange={(e) => setInputId(e.target.value)}
        className="max-w-xs"
      />
      <Button
        onClick={() => {
          const id = parseInt(inputId);
          if (!id || isNaN(id)) { return; }
          onPromote(id);
          setInputId("");
        }}
        disabled={isPending || !inputId}
      >
        {isPending ? "设置中..." : "设为管理员"}
      </Button>
    </div>
  );
}

const CUISINE_OPTIONS = ["中餐", "西餐", "日料", "韩餐", "快餐", "小吃", "甜品", "饮品", "其他"];
const PRICE_OPTIONS = ["¥ 便宜（人均 < 30）", "¥¥ 中等（人均 30-80）", "¥¥¥ 较贵（人均 > 80）"];

export default function Admin() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    cuisine: "",
    address: "",
    city: "太仓",
    district: "",
    phone: "",
    priceLevel: "",
    image: "",
    status: "published" as "published" | "pending" | "rejected",
  });

  const isSuperAdmin = user?.role === "super_admin";
  const isAdminOrAbove = user?.role === "admin" || user?.role === "super_admin";

  // Redirect if not admin
  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        navigate("/");
      } else if (!isAdminOrAbove) {
        toast.error("无权访问管理员后台");
        navigate("/feed");
      }
    }
  }, [loading, isAuthenticated, isAdminOrAbove, navigate]);

  const utils = trpc.useUtils();

  const { data: stats } = trpc.admin.getStats.useQuery(undefined, {
    enabled: isAuthenticated && isAdminOrAbove,
  });

  const { data: restaurants, isLoading: isLoadingRestaurants } = trpc.admin.getRestaurants.useQuery(
    { limit: 200, offset: 0 },
    { enabled: isAuthenticated && isAdminOrAbove && activeTab === "restaurants" }
  );

  const { data: usersList, isLoading: isLoadingUsers } = trpc.admin.getUsers.useQuery(
    { limit: 200, offset: 0 },
    { enabled: isAuthenticated && isSuperAdmin && activeTab === "users" }
  );

  const { data: adminsList, isLoading: isLoadingAdmins } = trpc.admin.getAdmins.useQuery(undefined, {
    enabled: isAuthenticated && isSuperAdmin && activeTab === "admins",
  });

  const setRoleMutation = trpc.admin.setUserRole.useMutation({
    onSuccess: () => {
      toast.success("权限已更新");
      utils.admin.getAdmins.invalidate();
      utils.admin.getUsers.invalidate();
    },
    onError: (e) => toast.error("更新失败：" + e.message),
  });

  const createMutation = trpc.admin.createRestaurant.useMutation({
    onSuccess: () => {
      toast.success("餐厅添加成功");
      setShowAddDialog(false);
      resetForm();
      utils.admin.getRestaurants.invalidate();
      utils.admin.getStats.invalidate();
    },
    onError: (e) => toast.error("添加失败：" + e.message),
  });

  const updateMutation = trpc.admin.updateRestaurant.useMutation({
    onSuccess: () => {
      toast.success("餐厅更新成功");
      setEditingRestaurant(null);
      resetForm();
      utils.admin.getRestaurants.invalidate();
    },
    onError: (e) => toast.error("更新失败：" + e.message),
  });

  const deleteMutation = trpc.admin.deleteRestaurant.useMutation({
    onSuccess: () => {
      toast.success("餐厅已删除");
      setDeletingId(null);
      utils.admin.getRestaurants.invalidate();
      utils.admin.getStats.invalidate();
    },
    onError: (e) => toast.error("删除失败：" + e.message),
  });

  const statusMutation = trpc.admin.updateRestaurantStatus.useMutation({
    onSuccess: () => {
      toast.success("状态已更新");
      utils.admin.getRestaurants.invalidate();
      utils.admin.getStats.invalidate();
    },
    onError: (e) => toast.error("更新失败：" + e.message),
  });

  const resetForm = () => {
    setForm({ name: "", description: "", cuisine: "", address: "", city: "太仓", district: "", phone: "", priceLevel: "", image: "", status: "published" });
    setImagePreview("");
  };

  const openEditDialog = (restaurant: any) => {
    setEditingRestaurant(restaurant);
    setForm({
      name: restaurant.name || "",
      description: restaurant.description || "",
      cuisine: restaurant.cuisine || "",
      address: restaurant.address || "",
      city: restaurant.city || "太仓",
      district: restaurant.district || "",
      phone: restaurant.phone || "",
      priceLevel: restaurant.priceLevel || "",
      image: restaurant.image || "",
      status: restaurant.status || "published",
    });
    setImagePreview(restaurant.image || "");
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片不能超过 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setForm((f) => ({ ...f, image: result }));
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("请输入餐厅名称");
      return;
    }
    if (editingRestaurant) {
      updateMutation.mutate({ id: editingRestaurant.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const filteredRestaurants = restaurants?.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.address || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusLabel = (status: string) => {
    if (status === "published") return <Badge className="bg-green-100 text-green-700 border-green-200">已发布</Badge>;
    if (status === "pending") return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">待审核</Badge>;
    return <Badge className="bg-red-100 text-red-700 border-red-200">已拒绝</Badge>;
  };

  if (loading || !isAuthenticated || !isAdminOrAbove) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-card border-r border-border flex flex-col fixed h-full z-10 shadow-sm">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl font-bold text-primary">吃了吗</span>
            <Badge variant="outline" className="text-xs">管理后台</Badge>
          </div>
          <p className="text-xs text-foreground/50">
            Hi，{user?.name || "管理员"}
            {isSuperAdmin && <span className="ml-1 text-primary font-semibold">★ 总管</span>}
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {[
            { id: "overview", label: "数据概览", icon: LayoutDashboard, show: true },
            { id: "restaurants", label: "餐厅管理", icon: UtensilsCrossed, show: true },
            { id: "users", label: "用户列表", icon: Users, show: isSuperAdmin },
            { id: "admins", label: "管理员管理", icon: ShieldCheck, show: isSuperAdmin },
          ].filter(item => item.show).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as AdminTab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === id
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={() => navigate("/feed")}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回社区
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-56 flex-1 p-8">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-6">数据概览</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "注册用户", value: stats?.totalUsers ?? "—", icon: Users, color: "text-blue-500" },
                { label: "帖子总数", value: stats?.totalPosts ?? "—", icon: FileText, color: "text-green-500" },
                { label: "餐厅总数", value: stats?.totalRestaurants ?? "—", icon: Store, color: "text-primary" },
                { label: "待审核", value: stats?.pendingRestaurants ?? "—", icon: Clock, color: "text-yellow-500" },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label} className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-foreground/60">{label}</p>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <p className="text-3xl font-bold text-foreground">{value}</p>
                </Card>
              ))}
            </div>

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-3">快捷操作</h2>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => { setActiveTab("restaurants"); setShowAddDialog(true); }} className="gap-2">
                  <Plus className="w-4 h-4" /> 添加餐厅
                </Button>
                <Button variant="outline" onClick={() => setActiveTab("restaurants")} className="gap-2">
                  <UtensilsCrossed className="w-4 h-4" /> 管理餐厅
                </Button>
                {isSuperAdmin && (
                <Button variant="outline" onClick={() => setActiveTab("users")} className="gap-2">
                  <Users className="w-4 h-4" /> 查看用户
                </Button>
              )}
              {isSuperAdmin && (
                <Button variant="outline" onClick={() => setActiveTab("admins")} className="gap-2">
                  <Users className="w-4 h-4" /> 管理员管理
                </Button>
              )}
              </div>
            </Card>
          </div>
        )}

        {/* Restaurants Tab */}
        {activeTab === "restaurants" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-foreground">餐厅管理</h1>
              <Button onClick={() => { resetForm(); setShowAddDialog(true); }} className="gap-2">
                <Plus className="w-4 h-4" /> 添加餐厅
              </Button>
            </div>

            <div className="mb-4">
              <Input
                placeholder="搜索餐厅名称或地址..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>

            {isLoadingRestaurants ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredRestaurants && filteredRestaurants.length > 0 ? (
              <div className="space-y-3">
                {filteredRestaurants.map((r) => (
                  <Card key={r.id} className="p-4">
                    <div className="flex items-center gap-4">
                      {r.image ? (
                        <img src={r.image} alt={r.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <UtensilsCrossed className="w-6 h-6 text-foreground/30" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate">{r.name}</h3>
                          {statusLabel(r.status)}
                        </div>
                        <p className="text-sm text-foreground/60 truncate">
                          {[r.cuisine, r.address, r.priceLevel].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Select
                          value={r.status}
                          onValueChange={(v) => statusMutation.mutate({ id: r.id, status: v as any })}
                        >
                          <SelectTrigger className="w-24 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="published">已发布</SelectItem>
                            <SelectItem value="pending">待审核</SelectItem>
                            <SelectItem value="rejected">已拒绝</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(r)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeletingId(r.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-16 text-center">
                <UtensilsCrossed className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
                <p className="text-foreground/60 mb-4">还没有餐厅数据</p>
                <Button onClick={() => { resetForm(); setShowAddDialog(true); }}>添加第一家餐厅</Button>
              </Card>
            )}
          </div>
        )}

        {/* Users Tab - super_admin only */}
        {activeTab === "users" && isSuperAdmin && (
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">用户列表</h1>
            <p className="text-sm text-foreground/60 mb-6">点击右侧按钮可直接设置或撤销管理员权限。</p>
            {isLoadingUsers ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
              </div>
            ) : usersList && usersList.length > 0 ? (
              <div className="space-y-2">
                {usersList.map((u: any) => (
                  <Card key={u.id} className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="font-bold text-primary text-sm">{u.name?.charAt(0) || "U"}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{u.name || "未设置昵称"}</p>
                          {u.role === "admin" && <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">管理员</Badge>}
                          {u.role === "super_admin" && <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">总管</Badge>}
                        </div>
                        <p className="text-sm text-foreground/60">{u.email}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {u.role === "user" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-primary border-primary/30 hover:bg-primary/10"
                            onClick={() => setRoleMutation.mutate({ userId: u.id, role: "admin" })}
                            disabled={setRoleMutation.isPending}
                          >
                            设为管理员
                          </Button>
                        )}
                        {u.role === "admin" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-500 border-red-200 hover:bg-red-50"
                            onClick={() => setRoleMutation.mutate({ userId: u.id, role: "user" })}
                            disabled={setRoleMutation.isPending}
                          >
                            撤销权限
                          </Button>
                        )}
                        {u.role === "super_admin" && (
                          <span className="text-xs text-foreground/40">总管理员</span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-16 text-center">
                <p className="text-foreground/60">暂无用户数据</p>
              </Card>
            )}
          </div>
        )}

        {/* Admins Tab - super_admin only */}
        {activeTab === "admins" && isSuperAdmin && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-foreground">管理员管理</h1>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                共 {adminsList ? adminsList.filter((a: any) => a.role === "admin").length : 0} 位管理员
              </Badge>
            </div>
            <p className="text-sm text-foreground/60 mb-6">设置用户为管理员后，对方可以登录管理后台并审核餐厅。仅您可以设置或撤销管理员权限。</p>

            {/* Add admin */}
            <Card className="p-5 mb-6 border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="w-4 h-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">添加管理员</h2>
              </div>
              <p className="text-sm text-foreground/60 mb-3">输入用户 ID 将其设为管理员（可在用户列表中查看用户 ID）</p>
              <PromoteUserForm onPromote={(userId) => setRoleMutation.mutate({ userId, role: "admin" })} isPending={setRoleMutation.isPending} />
            </Card>

            {/* Current admins list */}
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">当前管理员列表</h2>
            </div>
            {isLoadingAdmins ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
              </div>
            ) : adminsList && adminsList.filter((a: any) => a.role === "admin").length > 0 ? (
              <div className="space-y-2">
                {adminsList.filter((a: any) => a.role === "admin").map((a: any) => (
                  <Card key={a.id} className="p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="font-bold text-primary text-sm">{a.name?.charAt(0) || "A"}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{a.name || "未设置昵称"}</p>
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">管理员</Badge>
                        </div>
                        <p className="text-sm text-foreground/60">{a.email}</p>
                        <p className="text-xs text-foreground/40">ID: {a.id}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 border-red-200 hover:bg-red-50 flex-shrink-0"
                        onClick={() => setRoleMutation.mutate({ userId: a.id, role: "user" })}
                        disabled={setRoleMutation.isPending}
                      >
                        撤销权限
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-10 text-center">
                <ShieldCheck className="w-10 h-10 text-foreground/20 mx-auto mb-3" />
                <p className="text-foreground/60">暂无其他管理员</p>
                <p className="text-sm text-foreground/40 mt-1">在上方输入用户 ID 来添加管理员</p>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Add/Edit Restaurant Dialog */}
      <Dialog open={showAddDialog || !!editingRestaurant} onOpenChange={(open) => { if (!open) { setShowAddDialog(false); setEditingRestaurant(null); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRestaurant ? "编辑餐厅" : "添加餐厅"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Image upload */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">餐厅图片</label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="预览" className="w-full h-32 object-cover rounded-lg" />
                ) : (
                  <div className="py-4">
                    <Image className="w-8 h-8 text-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-foreground/50">点击上传图片（最大 5MB）</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">餐厅名称 *</label>
              <Input placeholder="例：太仓老街面馆" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">菜系</label>
                <Select value={form.cuisine} onValueChange={(v) => setForm((f) => ({ ...f, cuisine: v }))}>
                  <SelectTrigger><SelectValue placeholder="选择菜系" /></SelectTrigger>
                  <SelectContent>
                    {CUISINE_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">价格区间</label>
                <Select value={form.priceLevel} onValueChange={(v) => setForm((f) => ({ ...f, priceLevel: v }))}>
                  <SelectTrigger><SelectValue placeholder="选择价格" /></SelectTrigger>
                  <SelectContent>
                    {PRICE_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">地址</label>
              <Input placeholder="例：太仓市上海东路1800号" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">城市</label>
                <Input placeholder="太仓" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">区域</label>
                <Input placeholder="例：学校南门" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">电话</label>
              <Input placeholder="联系电话（选填）" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">简介</label>
              <Input placeholder="一句话介绍这家餐厅（选填）" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">状态</label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">已发布</SelectItem>
                  <SelectItem value="pending">待审核</SelectItem>
                  <SelectItem value="rejected">已拒绝</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditingRestaurant(null); resetForm(); }}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "保存中..." : editingRestaurant ? "保存修改" : "添加餐厅"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>此操作不可撤销，餐厅数据将被永久删除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
