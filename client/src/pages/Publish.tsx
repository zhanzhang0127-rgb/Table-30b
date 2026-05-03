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
import { CUISINES, getCuisineLabel, type Cuisine } from "@shared/cuisine";
import { PRICE_RANGES, getPriceRangeLabel, type PriceRange } from "@shared/priceRange";
import { useT } from "@/contexts/I18nContext";

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
  const { t, lang } = useT();

  const createPostMutation = trpc.posts.create.useMutation({
    onSuccess: () => {
      const labels: string[] = [];
      if (cuisine) labels.push(getCuisineLabel(cuisine, lang));
      if (pricePerPerson && pricePerPerson !== '不想透露') labels.push(pricePerPerson);
      if (labels.length > 0) {
        toast.success(t('toast.publishSuccessRanks', { labels: labels.join(' · ') }));
      } else {
        toast.success(t('toast.publishSuccess'));
      }
      navigate("/feed");
    },
    onError: (error) => {
      toast.error(t('toast.publishFailed', { error: error.message }));
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
      reader.onerror = () => reject(new Error("audio read error"));
      reader.readAsDataURL(blob);
    });

  const startVoiceRecording = async () => {
    if (voiceState.kind !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error(t('toast.browserNoRecord'));
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
          toast.info(t('toast.recordingLimit', { seconds: MAX_RECORDING_SECONDS }));
        }
      }, MAX_RECORDING_SECONDS * 1000);
    } catch {
      toast.error(t('toast.micFailed'));
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
        toast.error(t('toast.noAudio'));
        setVoiceState({ kind: "idle" });
        return;
      }
      setVoiceState({ kind: "transcribing" });
      const dataUrl = await blobToDataUrl(blob);
      const { text } = await transcribeDirect.mutateAsync({ dataUrl, language: "zh" });
      if (!text.trim()) {
        toast.error(t('toast.noSpeech'));
        setVoiceState({ kind: "idle" });
        return;
      }
      setVoiceState({ kind: "extracting" });
      const extracted = await extractPost.mutateAsync({ transcript: text });

      setTitle(extracted.title);
      const lines: string[] = [];
      if (extracted.content.trim()) lines.push(extracted.content.trim());
      if (extracted.restaurantNameHint) lines.push(`📍 ${extracted.restaurantNameHint}`);
      if (extracted.recommendedDish) lines.push(`👍 ${extracted.recommendedDish}`);
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

      toast.success(t('toast.voiceReady'));
      setVoiceState({ kind: "idle" });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('toast.voiceFailed');
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
        <span className="text-sm text-foreground/60">{value ?? t('publish.notRated')}</span>
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
            <span className="text-sm font-medium">{step === "review" ? t('publish.backToEdit') : t('publish.backToFeed')}</span>
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
                {step === 'compose' ? t('publish.stepCompose') : t('publish.stepReview')}
              </span>
            </div>
          )}

          {/* Type selection */}
          {postType === null ? (
            <Card className="p-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">{t('publish.typeTitle')}</h1>
              <p className="text-sm text-foreground/60 mb-8">{t('publish.typeSubtitle')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleSelectPostType("delivery")}
                  className="rounded-xl border border-border bg-muted/30 p-6 text-left transition-colors hover:bg-muted"
                >
                  <div className="mb-3 flex items-center gap-2 text-primary">
                    <Bike className="w-5 h-5" />
                    <span className="text-base font-semibold">{t('publish.typeDelivery')}</span>
                  </div>
                  <p className="text-sm text-foreground/70">{t('publish.typeDeliveryDesc')}</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPostType("dine-in")}
                  className="rounded-xl border border-border bg-muted/30 p-6 text-left transition-colors hover:bg-muted"
                >
                  <div className="mb-3 flex items-center gap-2 text-primary">
                    <UtensilsCrossed className="w-5 h-5" />
                    <span className="text-base font-semibold">{t('publish.typeDineIn')}</span>
                  </div>
                  <p className="text-sm text-foreground/70">{t('publish.typeDineInDesc')}</p>
                </button>
              </div>
            </Card>
          ) : step === "compose" ? (
            /* ─── STEP 1: Compose ─── */
            <Card className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-foreground">{t('publish.composeTitle')}</h1>
                <button
                  type="button"
                  onClick={() => setQuickMode(q => !q)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${quickMode ? 'bg-muted border-border text-foreground/70' : 'border-border text-foreground/40 hover:text-foreground/60'}`}
                >
                  <Zap className="w-3 h-3" />
                  {quickMode ? t('publish.quickModeOn') : t('publish.quickModeOff')}
                </button>
              </div>

              <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
                <span className="text-sm font-semibold text-foreground">
                  {postType === "delivery" ? t('publish.currentTypeDelivery') : t('publish.currentTypeDineIn')}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleSelectPostType(null)}>
                  {t('publish.switchType')}
                </Button>
              </div>

              {/* Voice Input */}
              <div className="mb-6 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{t('publish.voiceCardTitle')}</span>
                </div>
                <p className="text-xs text-foreground/60 mb-3">
                  {t('publish.voiceHint', { seconds: MAX_RECORDING_SECONDS })}
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
                        {t('publish.voiceStop')}
                      </Button>
                      <span className="flex items-center gap-2 text-sm text-foreground/70">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        {t('publish.voiceRecording')} {String(Math.floor(voiceState.seconds / 60)).padStart(2, "0")}:
                        {String(voiceState.seconds % 60).padStart(2, "0")}
                      </span>
                    </>
                  )}
                  {(voiceState.kind === "transcribing" || voiceState.kind === "extracting") && (
                    <span className="flex items-center gap-2 text-sm text-foreground/70">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {voiceState.kind === "transcribing" ? t('publish.voiceTranscribing') : t('publish.voiceExtracting')}
                    </span>
                  )}
                </div>
              </div>

              {/* Title */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  {t('publish.titleLabel')} <span className="text-xs text-foreground/50 font-normal">{t('publish.titleHelper')}</span>
                </label>
                <Input
                  placeholder={postType === 'delivery' ? t('publish.titlePlaceholderDelivery') : t('publish.titlePlaceholderDineIn')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  className="bg-muted/50 border-border"
                />
                <p className="text-xs text-foreground/50 mt-1">{t('publish.titleCharCount', { count: title.length })}</p>
              </div>

              {/* Content */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  {t('publish.contentLabel')}
                  <span className="text-xs text-foreground/50 font-normal ml-1">
                    {postType === 'delivery' ? t('publish.contentHelperDelivery') : t('publish.contentHelperDineIn')}
                  </span>
                </label>
                <Textarea
                  placeholder={postType === 'delivery' ? t('publish.contentPlaceholderDelivery') : t('publish.contentPlaceholderDineIn')}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={1000}
                  className="bg-muted/50 border-border min-h-40 resize-none"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-foreground/40">{t('publish.aiExtractionHint')}</p>
                  <p className="text-xs text-foreground/50 ml-3 flex-shrink-0">{content.length}/1000</p>
                </div>
              </div>

              {renderRatingRow(t('publish.ratingTaste'), tasteRating, setTasteRating)}
              {renderRatingRow(t('publish.ratingValue'), valueRating, setValueRating)}

              {postType === "dine-in" && (
                <div className="mb-6 rounded-lg border border-border bg-muted/20 p-4">
                  <label className="mb-2 block text-sm font-semibold text-foreground">{t('publish.locationLabel')}</label>
                  <Input
                    value={manualLocation}
                    onChange={(e) => setManualLocation(e.target.value)}
                    placeholder={t('publish.locationPlaceholder')}
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
                      {locationLoading ? t('publish.locationGetting') : t('publish.locationGet')}
                    </Button>
                    {manualLocation.trim() && (
                      <Button type="button" variant="ghost" onClick={() => { clearLocation(); setManualLocation(""); }}>
                        {t('publish.locationClear')}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Images */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-foreground mb-2">{t('publish.imagesLabel')}</label>
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
                      <p className="text-sm font-medium text-foreground">{t('publish.imagesClick')}</p>
                      <p className="text-xs text-muted-foreground">{t('publish.imagesFormats')}</p>
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
                    {isSubmitting ? t('publish.submitting') : t('publish.quickSubmitBtn')}
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
                        {t('publish.nextBtnLoading')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        {t('publish.nextBtn')}
                      </>
                    )}
                  </Button>
                )}
                <Button variant="outline" onClick={() => navigate("/feed")} disabled={isSubmitting}>
                  {t('publish.cancelBtn')}
                </Button>
              </div>
            </Card>
          ) : (
            /* ─── STEP 2: Review + Publish ─── */
            <Card className="p-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">{t('publish.reviewTitle')}</h1>
              {aiPrefilled && (
                <p className="text-xs text-primary/70 mb-6 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {t('publish.aiPrefillNote')}
                </p>
              )}

              {/* Summary of step 1 */}
              <div className="mb-6 rounded-lg bg-muted/30 border border-border p-4 text-sm space-y-1">
                <p className="font-semibold text-foreground line-clamp-1">{title}</p>
                <p className="text-foreground/60 text-xs line-clamp-2">{content}</p>
                <div className="flex gap-3 text-xs text-foreground/50 pt-1">
                  <span>{postType === 'delivery' ? t('feed.delivery') : t('feed.dineIn')}</span>
                  <span>😋 {tasteRating}</span>
                  <span>💰 {valueRating}</span>
                  {manualLocation && <span>📍 {manualLocation}</span>}
                </div>
              </div>

              {/* Cuisine selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  {t('publish.cuisineLabel')}
                  {aiPrefilled && cuisine && <span className="ml-2 text-xs text-primary/60 font-normal">{t('publish.aiTag')}</span>}
                </label>
                <div className="flex flex-wrap gap-2">
                  {CUISINES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCuisine(c === cuisine ? null : c)}
                      className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${cuisine === c ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground/60 hover:border-foreground/30'}`}
                    >
                      {getCuisineLabel(c, lang)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  {t('publish.priceLabel')}
                  {aiPrefilled && pricePerPerson && <span className="ml-2 text-xs text-primary/60 font-normal">{t('publish.aiTag')}</span>}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRICE_RANGES.map(range => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setPricePerPerson(range === pricePerPerson ? null : range)}
                      className={`text-sm px-3 py-2 rounded-lg border text-left transition-colors ${pricePerPerson === range ? 'bg-green-600 text-white border-green-600' : 'border-border text-foreground/60 hover:border-foreground/30'}`}
                    >
                      {getPriceRangeLabel(range, lang)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Restaurant hint */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  {t('publish.restaurantHintLabel')}
                  {aiPrefilled && restaurantHint && <span className="ml-2 text-xs text-primary/60 font-normal">{t('publish.aiTag')}</span>}
                </label>
                <Input
                  placeholder={t('publish.restaurantHintPlaceholder')}
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
                  {isSubmitting ? t('publish.submitting') : t('publish.submitBtn')}
                </Button>
                <Button variant="outline" onClick={() => setStep("compose")} disabled={isSubmitting}>
                  {t('publish.backToEdit')}
                </Button>
              </div>
            </Card>
          )}

          {/* Tips */}
          <Card className="mt-8 p-6 bg-muted/30 border-0">
            <h3 className="font-semibold text-foreground mb-3">{t('publish.tipsTitle')}</h3>
            <ul className="space-y-2 text-sm text-foreground/70">
              <li>• {t('publish.tip1')}</li>
              <li>• {t('publish.tip2')}</li>
              <li>• {t('publish.tip3')}</li>
              <li>• {t('publish.tip4')}</li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}
