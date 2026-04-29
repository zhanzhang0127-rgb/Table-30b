import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocationPicker } from "@/hooks/useLocationPicker";
import { ImagePlus, Loader2, X, ArrowLeft, Mic, Square, Sparkles, Bike, UtensilsCrossed, MapPin } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_RECORDING_SECONDS = 60;
type PostType = "delivery" | "dine-in";

type VoiceState =
  | { kind: "idle" }
  | { kind: "recording"; seconds: number }
  | { kind: "transcribing" }
  | { kind: "extracting" };

export default function Publish() {
  const { loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [postType, setPostType] = useState<PostType | null>(null);
  const [tasteRating, setTasteRating] = useState<number | null>(null);
  const [valueRating, setValueRating] = useState<number | null>(null);
  const [manualLocation, setManualLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>({ kind: "idle" });
  const {
    location,
    loading: locationLoading,
    fetchLocation,
    clearLocation,
  } = useLocationPicker();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transcribeDirect = trpc.voice.transcribeDirect.useMutation();
  const extractPost = trpc.voice.extractPost.useMutation();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  const createPostMutation = trpc.posts.create.useMutation({
    onSuccess: () => {
      toast.success("发布成功！");
      navigate("/feed");
    },
    onError: (error) => {
      toast.error("发布失败：" + error.message);
    },
  });

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
    if (location?.address) {
      setManualLocation(location.address);
    }
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
    } catch (err) {
      console.error(err);
      toast.error("无法访问麦克风，请检查浏览器权限");
    }
  };

  const stopVoiceRecording = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
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
      if (extracted.content.trim()) {
        lines.push(extracted.content.trim());
      }
      if (extracted.restaurantNameHint) {
        lines.push(`📍 提到的餐厅：${extracted.restaurantNameHint}`);
      }
      if (extracted.recommendedDish) {
        lines.push(`👍 推荐菜：${extracted.recommendedDish}`);
      }
      setContent(lines.join("\n\n"));
      toast.success("已整理，请检查后发布");
      setVoiceState({ kind: "idle" });
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "AI 整理失败";
      toast.error(message);
      setVoiceState({ kind: "idle" });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    // In a real app, you would upload to S3 here
    // For now, we'll create data URLs for demo purposes
    for (let i = 0; i < files.length && images.length < 9; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && event.target.result) {
          setImages(prev => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectPostType = (nextType: PostType | null) => {
    setPostType(nextType);
    if (nextType !== "dine-in") {
      clearLocation();
      setManualLocation("");
    }
  };

  const handleSubmit = async () => {
    if (!postType) {
      toast.error("请先选择发帖类型");
      return;
    }

    if (!title.trim() || !content.trim()) {
      toast.error("请填写标题和内容");
      return;
    }

    if (tasteRating === null || valueRating === null) {
      toast.error("请完成口味和性价比评分");
      return;
    }

    setIsSubmitting(true);
    try {
      await createPostMutation.mutateAsync({
        title,
        content,
        images: images.length > 0 ? images : undefined,
        postType,
        tasteRating,
        valueRating,
        location: postType === "dine-in" && manualLocation.trim() ? manualLocation.trim() : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
              className={`text-3xl leading-none transition-colors ${
                value !== null && value >= star ? "text-secondary" : "text-muted-foreground"
              }`}
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
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <main className="container py-6">
        <div className="max-w-2xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => navigate("/feed")}
            className="flex items-center gap-2 text-foreground/60 hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">返回社区</span>
          </button>

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
          ) : (
            <Card className="p-8">
              <h1 className="text-3xl font-bold text-foreground mb-6">分享你的美食故事</h1>

              <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
                <span className="text-sm font-semibold text-foreground">
                  当前类型：{postType === "delivery" ? "🛵 外卖" : "🍽 堂食"}
                </span>
                <Button type="button" variant="ghost" onClick={() => handleSelectPostType(null)}>
                  切换类型
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
                    <Button
                      type="button"
                      onClick={startVoiceRecording}
                      className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Mic className="w-4 h-4" />
                      开始录音
                    </Button>
                  )}
                  {voiceState.kind === "recording" && (
                    <>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={stopVoiceRecording}
                        className="gap-2"
                      >
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
                      {voiceState.kind === "transcribing" && "语音转文字中..."}
                      {voiceState.kind === "extracting" && "AI 整理中..."}
                    </span>
                  )}
                </div>
              </div>

              {/* Title Input */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  标题 * <span className="text-xs text-foreground/50 font-normal">（如：某餐厅的招牌菜真绝了）</span>
                </label>
                <Input
                  placeholder="例如：XXX餐厅的招牌菜、这家店的环境超舒服..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  className="bg-muted/50 border-border"
                />
                <p className="text-xs text-foreground/50 mt-1">{title.length}/100 字符</p>
              </div>

              {/* Content Textarea */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  内容 * <span className="text-xs text-foreground/50 font-normal">（分享你的美食体验和感受）</span>
                </label>
                <Textarea
                  placeholder="例如：这家店的菜品很新鲜，特别推荐他们的...\n环境很舒适，适合和朋友聚餐...\n价格也很合理，性价比很高..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={1000}
                  className="bg-muted/50 border-border min-h-40 resize-none"
                />
                <p className="text-xs text-foreground/50 mt-1">{content.length}/1000 字符</p>
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
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          clearLocation();
                          setManualLocation("");
                        }}
                      >
                        清空
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Image Upload */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-foreground mb-2">上传图片（最多9张）</label>

                {images.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={img}
                          alt={`Preview ${idx + 1}`}
                          className="w-full h-24 object-cover rounded-lg"
                          loading="lazy"
                        />
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
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                      <ImagePlus className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground">点击或拖拽上传图片</p>
                      <p className="text-xs text-muted-foreground">支持 JPG、PNG、WebP 格式</p>
                    </div>
                  </label>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex gap-3">
                <Button
                  onClick={handleSubmit}
                  disabled={
                    isSubmitting ||
                    !title.trim() ||
                    !content.trim() ||
                    !postType ||
                    tasteRating === null ||
                    valueRating === null
                  }
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? "发布中..." : "发布"}
                </Button>
                <Button variant="outline" onClick={() => navigate("/feed")} disabled={isSubmitting}>
                  取消
                </Button>
              </div>
            </Card>
          )}

          {/* Tips */}
          <Card className="mt-8 p-6 bg-muted/30 border-0">
            <h3 className="font-semibold text-foreground mb-3">💡 分享小贴士</h3>
            <ul className="space-y-2 text-sm text-foreground/70">
              <li>• 清晰的图片能让你的分享更吸引人</li>
              <li>• 详细的描述帮助其他用户更好地了解</li>
              <li>• 口味和性价比都打分，能让你的评价更有参考价值</li>
              <li>• 遵守社区规则，不发布不当内容</li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}
