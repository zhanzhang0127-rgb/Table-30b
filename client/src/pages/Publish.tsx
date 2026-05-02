import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { ImagePlus, Loader2, X, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Publish() {
  const { user, loading, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  const createPostMutation = trpc.posts.create.useMutation({
    onSuccess: () => {
      toast.success(t("publish.toastSuccess"));
      navigate("/feed");
    },
    onError: (error) => {
      toast.error(t("publish.toastFailed", { message: error.message }));
    },
  });

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

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error(t("publish.toastRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      await createPostMutation.mutateAsync({
        title,
        content,
        images: images.length > 0 ? images : undefined,
        rating: rating || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
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
      <main className="container py-6">
        <div className="max-w-2xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => navigate("/feed")}
            className="flex items-center gap-2 text-foreground/60 hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">{t("publish.back")}</span>
          </button>

          <Card className="p-8">
            <h1 className="text-3xl font-bold text-foreground mb-8">{t("publish.title")}</h1>

            {/* Title Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-foreground mb-2">
                {t("publish.titleLabel")} <span className="text-xs text-foreground/50 font-normal">{t("publish.titleHelp")}</span>
              </label>
              <Input
                placeholder={t("publish.titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                className="bg-muted/50 border-border"
              />
              <p className="text-xs text-foreground/50 mt-1">{t("publish.chars", { count: title.length, max: 100 })}</p>
            </div>

            {/* Content Textarea */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-foreground mb-2">
                {t("publish.contentLabel")} <span className="text-xs text-foreground/50 font-normal">{t("publish.contentHelp")}</span>
              </label>
              <Textarea
                placeholder={t("publish.contentPlaceholder")}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={1000}
                className="bg-muted/50 border-border min-h-40 resize-none"
              />
              <p className="text-xs text-foreground/50 mt-1">{t("publish.chars", { count: content.length, max: 1000 })}</p>
            </div>

            {/* Rating */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-foreground mb-2">
                {t("publish.ratingOptional")}
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(rating === star ? null : star)}
                    className={`text-3xl transition-colors ${
                      rating && rating >= star ? "text-secondary" : "text-muted-foreground"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Image Upload */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-foreground mb-2">
                {t("publish.uploadImages")}
              </label>
              
              {/* Image Preview Grid */}
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
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Button */}
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
                    <p className="text-sm font-medium text-foreground">{t("publish.uploadCta")}</p>
                    <p className="text-xs text-muted-foreground">{t("publish.uploadSupport")}</p>
                  </div>
                </label>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting || !title.trim() || !content.trim()}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? t("publish.submitting") : t("publish.submit")}
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate("/feed")}
                disabled={isSubmitting}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </Card>

          {/* Tips */}
          <Card className="mt-8 p-6 bg-muted/30 border-0">
            <h3 className="font-semibold text-foreground mb-3">💡 {t("publish.tipsTitle")}</h3>
            <ul className="space-y-2 text-sm text-foreground/70">
              <li>• {t("publish.tipPhotos")}</li>
              <li>• {t("publish.tipDetails")}</li>
              <li>• {t("publish.tipRating")}</li>
              <li>• {t("publish.tipRules")}</li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}
