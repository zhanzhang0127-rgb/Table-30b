import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Loader2, Upload, X, ChevronLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const CUISINE_OPTIONS = [
  "中餐", "西餐", "日料", "韩料", "火锅", "烧烤", "快餐",
  "奶茶饮品", "甜品", "面食", "海鲜", "素食", "其他",
];

const PRICE_OPTIONS = [
  { value: "1", label: "¥ 人均 10 元以下" },
  { value: "2", label: "¥¥ 人均 10-30 元" },
  { value: "3", label: "¥¥¥ 人均 30-80 元" },
  { value: "4", label: "¥¥¥¥ 人均 80 元以上" },
];

export default function SubmitRestaurant() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [phone, setPhone] = useState("");
  const [priceLevel, setPriceLevel] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reverseGeocode = trpc.restaurants.reverseGeocode.useMutation();
  const submitRestaurant = trpc.restaurants.submit.useMutation();

  // 跳转登录
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-sm mx-4">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">请先登录后再提交餐厅</p>
            <Button onClick={() => navigate("/")}>去登录</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 提交成功页面
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-sm mx-4">
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">提交成功！</h2>
            <p className="text-muted-foreground mb-6">
              感谢你的贡献！餐厅信息已提交，管理员审核通过后将正式上线。
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => {
                setSubmitted(false);
                setName(""); setDescription(""); setCuisine(""); setAddress("");
                setCity(""); setDistrict(""); setLatitude(""); setLongitude("");
                setPhone(""); setPriceLevel(""); setImagePreview(null); setImageBase64(null);
              }}>
                继续提交
              </Button>
              <Button onClick={() => navigate("/restaurants")}>查看餐厅</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("你的浏览器不支持定位功能");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLatitude(String(lat));
        setLongitude(String(lng));
        try {
          const result = await reverseGeocode.mutateAsync({ latitude: lat, longitude: lng });
          setAddress(result.address);
          setCity(result.city);
          setDistrict(result.district);
          toast.success("定位成功，地址已自动填入");
        } catch {
          toast.error("地址解析失败，请手动输入地址");
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error("定位权限被拒绝，请手动输入地址");
        } else {
          toast.error("定位失败，请手动输入地址");
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片大小不能超过 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setImagePreview(base64);
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("请输入餐厅名称");
      return;
    }
    try {
      await submitRestaurant.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        cuisine: cuisine || undefined,
        address: address.trim() || undefined,
        city: city || undefined,
        district: district || undefined,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        phone: phone.trim() || undefined,
        priceLevel: priceLevel || undefined,
        image: imageBase64 || undefined,
      });
      setSubmitted(true);
    } catch {
      toast.error("提交失败，请稍后重试");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="container flex items-center h-14 gap-3">
          <button
            onClick={() => navigate(-1 as any)}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">返回</span>
          </button>
          <h1 className="font-bold text-lg">提交餐厅</h1>
        </div>
      </div>

      <div className="container max-w-lg py-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 餐厅名称 */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              餐厅名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="例如：老王家炒饭"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* 地址 + 定位按钮 */}
          <div className="space-y-1.5">
            <Label htmlFor="address">餐厅地址</Label>
            <div className="flex gap-2">
              <Input
                id="address"
                placeholder="点击右侧按钮自动定位，或手动输入"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleGetLocation}
                disabled={isLocating}
                className="shrink-0 gap-1.5"
              >
                {isLocating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4 text-primary" />
                )}
                {isLocating ? "定位中..." : "获取位置"}
              </Button>
            </div>
            {latitude && longitude && (
              <p className="text-xs text-muted-foreground">
                📍 坐标已获取：{parseFloat(latitude).toFixed(5)}, {parseFloat(longitude).toFixed(5)}
              </p>
            )}
          </div>

          {/* 菜系 */}
          <div className="space-y-1.5">
            <Label>菜系类型</Label>
            <Select value={cuisine} onValueChange={setCuisine}>
              <SelectTrigger>
                <SelectValue placeholder="选择菜系" />
              </SelectTrigger>
              <SelectContent>
                {CUISINE_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 人均价格 */}
          <div className="space-y-1.5">
            <Label>人均消费</Label>
            <Select value={priceLevel} onValueChange={setPriceLevel}>
              <SelectTrigger>
                <SelectValue placeholder="选择价格区间" />
              </SelectTrigger>
              <SelectContent>
                {PRICE_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 电话 */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">联系电话（选填）</Label>
            <Input
              id="phone"
              placeholder="餐厅电话"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* 简介 */}
          <div className="space-y-1.5">
            <Label htmlFor="description">餐厅简介（选填）</Label>
            <Textarea
              id="description"
              placeholder="介绍一下这家餐厅的特色..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* 图片上传 */}
          <div className="space-y-1.5">
            <Label>餐厅图片（选填）</Label>
            {imagePreview ? (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border">
                <img src={imagePreview} alt="预览" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setImagePreview(null); setImageBase64(null); }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
              >
                <Upload className="w-8 h-8" />
                <span className="text-sm">点击上传餐厅图片</span>
                <span className="text-xs">支持 JPG、PNG，最大 5MB</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          {/* 提示 */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-700">
              📋 提交后将进入审核流程，管理员审核通过后餐厅将正式上线，感谢你的贡献！
            </p>
          </div>

          {/* 提交按钮 */}
          <Button
            type="submit"
            className="w-full"
            disabled={submitRestaurant.isPending || !name.trim()}
          >
            {submitRestaurant.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                提交中...
              </>
            ) : (
              "提交餐厅"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
