import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocationPicker } from "@/hooks/useLocationPicker";
import { ImagePlus, Loader2, X, ArrowLeft, Mic, Square, Sparkles, Bike, UtensilsCrossed, MapPin, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CUISINES, CUISINE_LABELS, type Cuisine } from "@shared/cuisine";
import { PRICE_RANGES, PRICE_RANGE_LABELS, type PriceRange } from "@shared/priceRange";

const MAX_RECORDING_SECONDS = 60;
type PostType = "delivery" | "dine-in";
type Step = "compose" | "review";

type VoiceState =
  | { kind: "idle" }
  | { kind: "recording"; seconds: number }
  | { kind: "transcribing" }
  | { kind: "extracting" };

export default function Publish() {
  const { loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // Step state
  const [step, setStep] = useState<Step>("compose");
  const [quickMode, setQuickMode] = useState(false);

  // Compose fields
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [postType, setPostType] = useState<PostType | null>(null);
  const [tasteRating, setTasteRating] = useState<number | null>(null);
  const [valueRating, setValueRating] = useState<number | null>(null);
  const [manualLocation, setManualLocation] = useState("");

  // Review/classification fields
  const [cuisine, setCuisine] = useState<Cuisine | null>(null);
  const [pricePerPerson, setPricePerPerson] = useState<PriceRange | null>(null);
  const [restaurantHint, setRestaurantHint] = useState("");
  const [aiPrefilled, setAiPrefilled] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>({ kind: "idle" });

  const { location, loading: locationLoading, fetchLocation, clearLocation } = useLocationPicker();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transcribeDirect = trpc.voice.transcribeDirect.useMutation();
  const extractPost = trpc.voice.extractPost.useMutation();
  const previewMutation = trpc.posts.preview.useMutation();

  const createPostMutation = trpc.posts.create.useMutation({
    onSuccess: () => {
      const labels: string[] = [];
      if (cuisine) labels.push(CUISINE_LABELS[cuisine]);
      if (pricePerPerson && pricePerPerson !== '不想透露') labels.push(pricePerPerson);
      if (labels.length > 0) {
        toast.success(`发布成功！已进入 🔥 本周热门候选 · ${labels.join(' · ')}`);
      } else {
        toast.success("发布成功！");
      }
      navigate("/feed");
    },
    onError: (error) => {
      toast.error("发布失败：" + error.message);
    },
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/");
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (location?.address) setManualLocation(location.address);
  }, [location?.address]);

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("音频读取失败"));
      reader.readAsDataURL(blob);
    });

  const startVoiceRecording = async () => {
    if (voiceState.kind !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("当前浏览器不支持录音");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void processVoiceBlob(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setVoiceState({ kind: "recording", seconds: 0 });
      tickRef.current = setInterval(() => {
        setVoiceState(prev => {
          if (prev.kind !== "recording") return prev;
          return { kind: "recording", seconds: prev.seconds + 1 };
        });
      }, 1000);
      autoStopRef.current = setTimeout(() => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
          toast.info(`已自动停止（${MAX_RECORDING_SECONDS} 秒上限）`);
        }
      }, MAX_RECORDING_SECONDS * 1000);
    } catch {
      toast.error("无法访问麦克风，请检查浏览器权限");
    }
  };

  const stopVoiceRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
  };

  const processVoiceBlob = async (blob: Blob) => {
    try {
      if (blob.size === 0) {
        toast.error("没有录到声音");
        setVoiceState({ kind: "idle" });
        return;
      }
      setVoiceState({ kind: "transcribing" });
      const dataUrl = await blobToDataUrl(blob);
      const { text } = await transcribeDirect.mutateAsync({ dataUrl, language: "zh" });
      if (!text.trim()) {
        toast.error("未识别到语音内容，请重试");
        setVoiceState({ kind: "idle" });
        return;
      }
      setVoiceState({ kind: "extracting" });
      const extracted = await extractPost.mutateAsync({ transcript: text });

      setTitle(extracted.title);
      const lines: string[] = [];
      if (extracted.content.trim()) lines.push(extracted.content.trim());
      if (extracted.restaurantNameHint) lines.push(`📍 提到的餐厅：${extracted.restaurantNameHint}`);
      if (extracted.recommendedDish) lines.push(`👍 推荐菜：${extracted.recommendedDish}`);
      setContent(lines.join("\n\n"));

      // Auto-fill classification from voice extraction
      if (extracted.cuisine && CUISINES.includes(extracted.cuisine as Cuisine)) {
        setCuisine(extracted.cuisine as Cuisine);
      }
      if (extracted.pricePerPerson && PRICE_RANGES.includes(extracted.pricePerPerson as PriceRange)) {
        setPricePerPerson(extracted.pricePerPerson as PriceRange);
      }
      if (extracted.restaurantNameHint) setRestaurantHint(extracted.restaurantNameHint);
      setAiPrefilled(true);

      toast.success("已整理，请检查后发布");
      setVoiceState({ kind: "idle" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI 整理失败";
      toast.error(message);
      setVoiceState({ kind: "idle" });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;
    for (let i = 0; i < files.length && images.length < 9; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) setImages(prev => [...prev, event.target!.result as string]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => setImages(prev => prev.filter((_, i) => i !== index));

  const handleSelectPostType = (nextType: PostType | null) => {
    setPostType(nextType);
    if (nextType !== "dine-in") { clearLocation(); setManualLocation(""); }
  };

  const handleNext = async () => {
    if (quickMode) {
      setStep("review");
      return;
    }
    // AI preview
    try {
      const result = await previewMutation.mutateAsync({ title, content });
      if (result.cuisine && CUISINES.includes(result.cuisine as Cuisine)) setCuisine(result.cuisine as Cuisine);
      if (result.pricePerPerson && PRICE_RANGES.includes(result.pricePerPerson as PriceRange)) setPricePerPerson(result.pricePerPerson as PriceRange);
      if (result.restaurantHint) setRestaurantHint(result.restaurantHint);
      setAiPrefilled(true);
    } catch {
      // AI failed silently — user can fill manually
    }
    setStep("review");
  };

  const handleSubmit = async () => {
    if (!postType || !title.trim() || !content.trim() || tasteRating === null || valueRating === null) return;
    const averageRating = Math.round((tasteRating + valueRating) / 2);
    setIsSubmitting(true);
    try {
      await createPostMutation.mutateAsync({
        title,
        content,
        images: images.length > 0 ? images : undefined,
        postType,
        tasteRating,
        valueRating,
        rating: averageRating,
        location: postType === "dine-in" && manualLocation.trim() ? manualLocation.trim() : undefined,
        cuisine: cuisine ?? undefined,
        pricePerPerson: pricePerPerson ?? undefined,
        restaurantHint: restaurantHint.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const composeValid = title.trim() && content.trim() && postType && tasteRating !== null && valueRating !== null;

  const renderRatingRow = (
    label: string,
    value: number | null,
    onChange: (next: number) => void,
  ) => (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-foreground mb-2">{label} *</label>
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={`${label}-${star}`}
              type="button"
              onClick={() => onChange(star)}
              className={`text-3xl leading-none transition-colors ${value !== null && value >= star ? "text-secondary" : "text-muted-foreground"}`}
              aria-label={`${label}${star}星`}
            >
              ★
            </button>
          ))}
        </div>
        <span className="text-sm text-foreground/60">{value ?? "未评分"}</span>
      </div>
    </div>
  );

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-6">
        <div className="max-w-2xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => step === "review" ? setStep("compose") : navigate("/feed")}
            className="flex items-center gap-2 text-foreground/60 hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">{step === "review" ? "返回修改" : "返回社区"}</span>
          </button>

          {/* Step indicator */}
          {postType !== null && (
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 'compose' ? 'bg-primary text-primary-foreground' : 'bg-green-500 text-white'}`}>
                {step === 'review' ? '✓' : '1'}
              </div>
              <div className={`h-0.5 flex-1 max-w-[40px] ${step === 'review' ? 'bg-green-500' : 'bg-muted'}`} />
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 'review' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                2
              </div>
              <span className="text-xs text-foreground/50 ml-1">
                {step === 'compose' ? '写帖子' : 'AI 整理 + 发布'}
              </span>
            </div>
          )}

          {/* Type selection */}
          {postType === null ? (
            <Card className="p-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">你想分享什么？</h1>
              <p className="text-sm text-foreground/60 mb-8">先选择发帖类型，我们会为你展示更匹配的字段。</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleSelectPostType("delivery")}
                  className="rounded-xl border border-border bg-muted/30 p-6 text-left transition-colors hover:bg-muted"
                >
                  <div className="mb-3 flex items-center gap-2 text-primary">
                    <Bike className="w-5 h-5" />
                    <span className="text-base font-semibold">外卖</span>
                  </div>
                  <p className="text-sm text-foreground/70">分享点外卖的真实体验，帮助同学避坑或种草。</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPostType("dine-in")}
                  className="rounded-xl border border-border bg-muted/30 p-6 text-left transition-colors hover:bg-muted"
                >
                  <div className="mb-3 flex items-center gap-2 text-primary">
                    <UtensilsCrossed className="w-5 h-5" />
                    <span className="text-base font-semibold">堂食</span>
                  </div>
                  <p className="text-sm text-foreground/70">记录到店体验，可添加位置标签方便大家定位。</p>
                </button>
              </div>
            </Card>
          ) : step === "compose" ? (
            /* ─── STEP 1: Compose ─── */
            <Card className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-foreground">分享你的美食故事</h1>
                <button
                  type="button"
                  onClick={() => setQuickMode(q => !q)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${quickMode ? 'bg-muted border-border text-foreground/70' : 'border-border text-foreground/40 hover:text-foreground/60'}`}
                >
                  <Zap className="w-3 h-3" />
                  {quickMode ? '极速发（标签留空，不进类别榜）' : '极速发'}
                </button>
              </div>

              <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
                <span className="text-sm font-semibold text-foreground">
                  {postType === "delivery" ? "🛵 外卖" : "🍽 堂食"}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleSelectPostType(null)}>
                  切换
                </Button>
              </div>

              {/* Voice Input */}
              <div className="mb-6 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">用语音整理你的体验（实验功能）</span>
                </div>
                <p className="text-xs text-foreground/60 mb-3">
                  💡 说话时请说出餐厅的<strong>完整名字</strong>，AI 会更准确地识别。最长 {MAX_RECORDING_SECONDS} 秒。
                </p>
                <div className="flex items-center gap-3">
                  {voiceState.kind === "idle" && (
                    <Button type="button" onClick={startVoiceRecording} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                      <Mic className="w-4 h-4" />
                      开始录音
                    </Button>
                  )}
                  {voiceState.kind === "recording" && (
                    <>
                      <Button type="button" variant="destructive" onClick={stopVoiceRecording} className="gap-2">
                        <Square className="w-4 h-4 fill-current" />
                        停止并整理
                      </Button>
                      <span className="flex items-center gap-2 text-sm text-foreground/70">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        录音中 {String(Math.floor(voiceState.seconds / 60)).padStart(2, "0")}:
                        {String(voiceState.seconds % 60).padStart(2, "0")}
                      </span>
                    </>
                  )}
                  {(voiceState.kind === "transcribing" || voiceState.kind === "extracting") && (
                    <span className="flex items-center gap-2 text-sm text-foreground/70">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {voiceState.kind === "transcribing" ? "语音转文字中..." : "AI 整理中..."}
                    </span>
                  )}
                </div>
              </div>

              {/* Title */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  标题 * <span className="text-xs text-foreground/50 font-normal">（一句话给出你的核心结论）</span>
                </label>
                <Input
                  placeholder={postType === 'delivery'
                    ? "如：万达麦当劳外卖到得挺快，但薯条全软了"
                    : "如：兰州拉面馆的牛肉面，比东路那家鲜 / 海底捞踩雷，等位 1 小时还涨价"}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  className="bg-muted/50 border-border"
                />
                <p className="text-xs text-foreground/50 mt-1">{title.length}/100 字符</p>
              </div>

              {/* Content */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  内容 *
                  <span className="text-xs text-foreground/50 font-normal ml-1">
                    {postType === 'delivery'
                      ? "（写真实细节最有用：什么时候点的、配送多久、份量、保温、有没有踩坑）"
                      : "（写真实细节最有用：什么时候去的、几个人、点了什么、环境/服务怎样）"}
                  </span>
                </label>
                <Textarea
                  placeholder={postType === 'delivery'
                    ? "周二中午点的，配送 35 分钟，到的时候还热乎。\n份量比想象中大，¥18 一份性价比还行。\n但米饭有点少，建议加米饭。"
                    : "周三晚上 7 点和室友去的，等位 20 分钟。\n点了牛肉面和炸酱面，牛肉面的汤是真材实料炖的...\n服务员态度一般，但出餐很快。"}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={1000}
                  className="bg-muted/50 border-border min-h-40 resize-none"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-foreground/40">
                    💡 别担心写不完整 — 下一步 AI 会自动从你的内容里提取「菜系 / 价格 / 推荐菜」标签
                  </p>
                  <p className="text-xs text-foreground/50 ml-3 flex-shrink-0">{content.length}/1000</p>
                </div>
              </div>

              {renderRatingRow("口味评分", tasteRating, setTasteRating)}
              {renderRatingRow("性价比评分", valueRating, setValueRating)}

              {postType === "dine-in" && (
                <div className="mb-6 rounded-lg border border-border bg-muted/20 p-4">
                  <label className="mb-2 block text-sm font-semibold text-foreground">📍 位置标签（可选）</label>
                  <Input
                    value={manualLocation}
                    onChange={(e) => setManualLocation(e.target.value)}
                    placeholder="可手动输入位置，或点击获取当前位置"
                    className="bg-background"
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => void fetchLocation()}
                      disabled={locationLoading}
                    >
                      {locationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                      {locationLoading ? "定位中..." : "获取位置"}
                    </Button>
                    {manualLocation.trim() && (
                      <Button type="button" variant="ghost" onClick={() => { clearLocation(); setManualLocation(""); }}>
                        清空
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Images */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-foreground mb-2">上传图片（最多9张）</label>
                {images.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-24 object-cover rounded-lg" loading="lazy" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {images.length < 9 && (
                  <label className="block">
                    <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                      <ImagePlus className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground">点击或拖拽上传图片</p>
                      <p className="text-xs text-muted-foreground">支持 JPG、PNG、WebP 格式</p>
                    </div>
                  </label>
                )}
              </div>

              {/* Next / Quick submit */}
              <div className="flex gap-3">
                {quickMode ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={!composeValid || isSubmitting}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSubmitting ? "发布中..." : "⚡ 极速发布"}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    disabled={!composeValid || previewMutation.isPending}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                  >
                    {previewMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        AI 整理中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        下一步
                      </>
                    )}
                  </Button>
                )}
                <Button variant="outline" onClick={() => navigate("/feed")} disabled={isSubmitting}>
                  取消
                </Button>
              </div>
            </Card>
          ) : (
            /* ─── STEP 2: Review + Publish ─── */
            <Card className="p-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">AI 已整理，请校对后发布</h1>
              {aiPrefilled && (
                <p className="text-xs text-primary/70 mb-6 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  以下信息由 AI 根据你的内容推测，可自由修改
                </p>
              )}

              {/* Summary of step 1 */}
              <div className="mb-6 rounded-lg bg-muted/30 border border-border p-4 text-sm space-y-1">
                <p className="font-semibold text-foreground line-clamp-1">{title}</p>
                <p className="text-foreground/60 text-xs line-clamp-2">{content}</p>
                <div className="flex gap-3 text-xs text-foreground/50 pt-1">
                  <span>{postType === 'delivery' ? '🛵 外卖' : '🍽 堂食'}</span>
                  <span>😋 {tasteRating}</span>
                  <span>💰 {valueRating}</span>
                  {manualLocation && <span>📍 {manualLocation}</span>}
                </div>
              </div>

              {/* Cuisine selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  美食类别
                  {aiPrefilled && cuisine && <span className="ml-2 text-xs text-primary/60 font-normal">AI 推测</span>}
                </label>
                <div className="flex flex-wrap gap-2">
                  {CUISINES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCuisine(c === cuisine ? null : c)}
                      className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${cuisine === c ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground/60 hover:border-foreground/30'}`}
                    >
                      {CUISINE_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  人均消费
                  {aiPrefilled && pricePerPerson && <span className="ml-2 text-xs text-primary/60 font-normal">AI 推测</span>}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRICE_RANGES.map(range => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setPricePerPerson(range === pricePerPerson ? null : range)}
                      className={`text-sm px-3 py-2 rounded-lg border text-left transition-colors ${pricePerPerson === range ? 'bg-green-600 text-white border-green-600' : 'border-border text-foreground/60 hover:border-foreground/30'}`}
                    >
                      {PRICE_RANGE_LABELS[range]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Restaurant hint */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  店名提示（选填）
                  {aiPrefilled && restaurantHint && <span className="ml-2 text-xs text-primary/60 font-normal">AI 推测</span>}
                </label>
                <Input
                  placeholder="如：海底捞万达店"
                  value={restaurantHint}
                  onChange={e => setRestaurantHint(e.target.value)}
                  maxLength={100}
                  className="bg-muted/50 border-border"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? "发布中..." : "发布"}
                </Button>
                <Button variant="outline" onClick={() => setStep("compose")} disabled={isSubmitting}>
                  返回修改
                </Button>
              </div>
            </Card>
          )}

          {/* Tips */}
          <Card className="mt-8 p-6 bg-muted/30 border-0">
            <h3 className="font-semibold text-foreground mb-3">💡 分享小贴士</h3>
            <ul className="space-y-2 text-sm text-foreground/70">
              <li>• 发布后你的帖子会自动进入排行榜候选</li>
              <li>• 填写类别和人均价格，帮助同学更快找到你的推荐</li>
              <li>• 口味和性价比双评分，让你的评价更有参考价值</li>
              <li>• 遵守社区规则，不发布不当内容</li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}
