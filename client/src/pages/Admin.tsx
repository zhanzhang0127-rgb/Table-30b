import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
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
  const { t } = useLanguage();
  const [inputId, setInputId] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        type="number"
        placeholder={t("admin.userIdPlaceholder")}
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
        {isPending ? t("admin.setting") : t("admin.setAdmin")}
      </Button>
    </div>
  );
}

const CUISINE_OPTIONS = [
  { value: "中餐", labelKey: "admin.cuisineChinese" },
  { value: "西餐", labelKey: "admin.cuisineWestern" },
  { value: "日料", labelKey: "admin.cuisineJapanese" },
  { value: "韩餐", labelKey: "admin.cuisineKorean" },
  { value: "快餐", labelKey: "admin.cuisineFastFood" },
  { value: "小吃", labelKey: "admin.cuisineSnacks" },
  { value: "甜品", labelKey: "admin.cuisineDessert" },
  { value: "饮品", labelKey: "admin.cuisineDrinks" },
  { value: "其他", labelKey: "admin.cuisineOther" },
];
const PRICE_OPTIONS = [
  { value: "¥ 便宜（人均 < 30）", labelKey: "admin.priceCheap" },
  { value: "¥¥ 中等（人均 30-80）", labelKey: "admin.priceMedium" },
  { value: "¥¥¥ 较贵（人均 > 80）", labelKey: "admin.priceExpensive" },
];

export default function Admin() {
  const { user, loading, isAuthenticated } = useAuth();
  const { t } = useLanguage();
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
        toast.error(t("admin.toastForbidden"));
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
      toast.success(t("admin.toastRoleUpdated"));
      utils.admin.getAdmins.invalidate();
      utils.admin.getUsers.invalidate();
    },
    onError: (e) => toast.error(t("admin.toastUpdateFailed", { message: e.message })),
  });

  const createMutation = trpc.admin.createRestaurant.useMutation({
    onSuccess: () => {
      toast.success(t("admin.toastRestaurantAdded"));
      setShowAddDialog(false);
      resetForm();
      utils.admin.getRestaurants.invalidate();
      utils.admin.getStats.invalidate();
    },
    onError: (e) => toast.error(t("admin.toastAddFailed", { message: e.message })),
  });

  const updateMutation = trpc.admin.updateRestaurant.useMutation({
    onSuccess: () => {
      toast.success(t("admin.toastRestaurantUpdated"));
      setEditingRestaurant(null);
      resetForm();
      utils.admin.getRestaurants.invalidate();
    },
    onError: (e) => toast.error(t("admin.toastUpdateFailed", { message: e.message })),
  });

  const deleteMutation = trpc.admin.deleteRestaurant.useMutation({
    onSuccess: () => {
      toast.success(t("admin.toastRestaurantDeleted"));
      setDeletingId(null);
      utils.admin.getRestaurants.invalidate();
      utils.admin.getStats.invalidate();
    },
    onError: (e) => toast.error(t("admin.toastDeleteFailed", { message: e.message })),
  });

  const statusMutation = trpc.admin.updateRestaurantStatus.useMutation({
    onSuccess: () => {
      toast.success(t("admin.toastStatusUpdated"));
      utils.admin.getRestaurants.invalidate();
      utils.admin.getStats.invalidate();
    },
    onError: (e) => toast.error(t("admin.toastUpdateFailed", { message: e.message })),
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
      toast.error(t("admin.toastImageTooLarge"));
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
      toast.error(t("admin.toastNameRequired"));
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
    if (status === "published") return <Badge className="bg-green-100 text-green-700 border-green-200">{t("admin.published")}</Badge>;
    if (status === "pending") return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">{t("admin.pending")}</Badge>;
    return <Badge className="bg-red-100 text-red-700 border-red-200">{t("admin.rejected")}</Badge>;
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
            <Badge variant="outline" className="text-xs">{t("admin.title")}</Badge>
          </div>
          <p className="text-xs text-foreground/50">
            {t("admin.greeting", { name: user?.name || t("admin.adminFallback") })}
            {isSuperAdmin && <span className="ml-1 text-primary font-semibold">★ {t("admin.superAdmin")}</span>}
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {[
            { id: "overview", label: t("admin.overview"), icon: LayoutDashboard, show: true },
            { id: "restaurants", label: t("admin.restaurantManagement"), icon: UtensilsCrossed, show: true },
            { id: "users", label: t("admin.userList"), icon: Users, show: isSuperAdmin },
            { id: "admins", label: t("admin.adminManagement"), icon: ShieldCheck, show: isSuperAdmin },
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
            {t("admin.backCommunity")}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-56 flex-1 p-8">
        <div className="fixed right-6 top-4 z-20">
          <LanguageSwitcher />
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-6">{t("admin.overview")}</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: t("admin.totalUsers"), value: stats?.totalUsers ?? "—", icon: Users, color: "text-blue-500" },
                { label: t("admin.totalPosts"), value: stats?.totalPosts ?? "—", icon: FileText, color: "text-green-500" },
                { label: t("admin.totalRestaurants"), value: stats?.totalRestaurants ?? "—", icon: Store, color: "text-primary" },
                { label: t("admin.pendingReview"), value: stats?.pendingRestaurants ?? "—", icon: Clock, color: "text-yellow-500" },
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
              <h2 className="text-lg font-semibold text-foreground mb-3">{t("admin.quickActions")}</h2>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => { setActiveTab("restaurants"); setShowAddDialog(true); }} className="gap-2">
                  <Plus className="w-4 h-4" /> {t("admin.addRestaurant")}
                </Button>
                <Button variant="outline" onClick={() => setActiveTab("restaurants")} className="gap-2">
                  <UtensilsCrossed className="w-4 h-4" /> {t("admin.manageRestaurants")}
                </Button>
                {isSuperAdmin && (
                <Button variant="outline" onClick={() => setActiveTab("users")} className="gap-2">
                  <Users className="w-4 h-4" /> {t("admin.viewUsers")}
                </Button>
              )}
              {isSuperAdmin && (
                <Button variant="outline" onClick={() => setActiveTab("admins")} className="gap-2">
                  <Users className="w-4 h-4" /> {t("admin.adminManagement")}
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
              <h1 className="text-2xl font-bold text-foreground">{t("admin.restaurantManagement")}</h1>
              <Button onClick={() => { resetForm(); setShowAddDialog(true); }} className="gap-2">
                <Plus className="w-4 h-4" /> {t("admin.addRestaurant")}
              </Button>
            </div>

            <div className="mb-4">
              <Input
                placeholder={t("admin.searchRestaurants")}
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
                            <SelectItem value="published">{t("admin.published")}</SelectItem>
                            <SelectItem value="pending">{t("admin.pending")}</SelectItem>
                            <SelectItem value="rejected">{t("admin.rejected")}</SelectItem>
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
                <p className="text-foreground/60 mb-4">{t("admin.noRestaurants")}</p>
                <Button onClick={() => { resetForm(); setShowAddDialog(true); }}>{t("admin.addFirstRestaurant")}</Button>
              </Card>
            )}
          </div>
        )}

        {/* Users Tab - super_admin only */}
        {activeTab === "users" && isSuperAdmin && (
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{t("admin.userList")}</h1>
            <p className="text-sm text-foreground/60 mb-6">{t("admin.usersHelp")}</p>
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
                          <p className="font-medium text-foreground">{u.name || t("admin.nicknameMissing")}</p>
                          {u.role === "admin" && <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">{t("admin.admin")}</Badge>}
                          {u.role === "super_admin" && <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">{t("admin.superAdmin")}</Badge>}
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
                            {t("admin.setAdmin")}
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
                            {t("admin.revoke")}
                          </Button>
                        )}
                        {u.role === "super_admin" && (
                          <span className="text-xs text-foreground/40">{t("admin.superAdminFull")}</span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-16 text-center">
                <p className="text-foreground/60">{t("admin.noUsers")}</p>
              </Card>
            )}
          </div>
        )}

        {/* Admins Tab - super_admin only */}
        {activeTab === "admins" && isSuperAdmin && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-foreground">{t("admin.adminManagement")}</h1>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                {t("admin.adminCount", { count: adminsList ? adminsList.filter((a: any) => a.role === "admin").length : 0 })}
              </Badge>
            </div>
            <p className="text-sm text-foreground/60 mb-6">{t("admin.adminHelp")}</p>

            {/* Add admin */}
            <Card className="p-5 mb-6 border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="w-4 h-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">{t("admin.addAdmin")}</h2>
              </div>
              <p className="text-sm text-foreground/60 mb-3">{t("admin.addAdminHelp")}</p>
              <PromoteUserForm onPromote={(userId) => setRoleMutation.mutate({ userId, role: "admin" })} isPending={setRoleMutation.isPending} />
            </Card>

            {/* Current admins list */}
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">{t("admin.currentAdmins")}</h2>
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
                          <p className="font-medium text-foreground">{a.name || t("admin.nicknameMissing")}</p>
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">{t("admin.admin")}</Badge>
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
                        {t("admin.revoke")}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-10 text-center">
                <ShieldCheck className="w-10 h-10 text-foreground/20 mx-auto mb-3" />
                <p className="text-foreground/60">{t("admin.noOtherAdmins")}</p>
                <p className="text-sm text-foreground/40 mt-1">{t("admin.addAdminEmptyHelp")}</p>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Add/Edit Restaurant Dialog */}
      <Dialog open={showAddDialog || !!editingRestaurant} onOpenChange={(open) => { if (!open) { setShowAddDialog(false); setEditingRestaurant(null); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRestaurant ? t("admin.editRestaurant") : t("admin.addRestaurant")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Image upload */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t("admin.restaurantImage")}</label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt={t("admin.previewAlt")} className="w-full h-32 object-cover rounded-lg" />
                ) : (
                  <div className="py-4">
                    <Image className="w-8 h-8 text-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-foreground/50">{t("admin.uploadImage")}</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("admin.restaurantName")}</label>
              <Input placeholder={t("admin.restaurantNamePlaceholder")} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("admin.cuisine")}</label>
                <Select value={form.cuisine} onValueChange={(v) => setForm((f) => ({ ...f, cuisine: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("admin.chooseCuisine")} /></SelectTrigger>
                  <SelectContent>
                    {CUISINE_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{t(c.labelKey)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("admin.priceRange")}</label>
                <Select value={form.priceLevel} onValueChange={(v) => setForm((f) => ({ ...f, priceLevel: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("admin.choosePrice")} /></SelectTrigger>
                  <SelectContent>
                    {PRICE_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{t(p.labelKey)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("admin.address")}</label>
              <Input placeholder={t("admin.addressPlaceholder")} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("admin.city")}</label>
                <Input placeholder="太仓" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("admin.district")}</label>
                <Input placeholder={t("admin.districtPlaceholder")} value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("admin.phone")}</label>
              <Input placeholder={t("admin.phonePlaceholder")} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("admin.description")}</label>
              <Input placeholder={t("admin.descriptionPlaceholder")} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("admin.status")}</label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">{t("admin.published")}</SelectItem>
                  <SelectItem value="pending">{t("admin.pending")}</SelectItem>
                  <SelectItem value="rejected">{t("admin.rejected")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditingRestaurant(null); resetForm(); }}>{t("common.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? t("admin.saving") : editingRestaurant ? t("admin.saveChanges") : t("admin.addRestaurant")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.deleteWarning")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
            >
              {t("admin.confirmDeleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
