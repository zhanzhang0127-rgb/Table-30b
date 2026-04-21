import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, Loader2, X, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Publish() {
  const { user, loading, isAuthenticated } = useAuth();
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
      toast.success("发布成功！");
      navigate("/feed");
    },
    onError: (error) => {
      toast.error("发布失败：" + error.message);
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
      toast.error("请填写标题和内容");
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
            <span className="text-sm font-medium">返回社区</span>
          </button>

          <Card className="p-8">
            <h1 className="text-3xl font-bold text-foreground mb-8">分享你的美食故事</h1>

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

            {/* Rating */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-foreground mb-2">
                评分（可选）
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
                上传图片（最多9张）
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
                disabled={isSubmitting || !title.trim() || !content.trim()}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? "发布中..." : "发布"}
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate("/feed")}
                disabled={isSubmitting}
              >
                取消
              </Button>
            </div>
          </Card>

          {/* Tips */}
          <Card className="mt-8 p-6 bg-muted/30 border-0">
            <h3 className="font-semibold text-foreground mb-3">💡 分享小贴士</h3>
            <ul className="space-y-2 text-sm text-foreground/70">
              <li>• 清晰的图片能让你的分享更吸引人</li>
              <li>• 详细的描述帮助其他用户更好地了解</li>
              <li>• 给餐厅评分，帮助社区了解质量</li>
              <li>• 遵守社区规则，不发布不当内容</li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}
