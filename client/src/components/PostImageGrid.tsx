import { ZoomIn } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type PostImageGridProps = {
  images: string[];
  variant?: "feed" | "detail";
  onOpenImage?: (image: string) => void;
};

export function PostImageGrid({
  images,
  variant = "feed",
  onOpenImage,
}: PostImageGridProps) {
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const imageKey = images.join("|");

  useEffect(() => {
    setFailedImages(new Set());
  }, [imageKey]);

  const visibleImages = useMemo(
    () => images.filter((image) => !failedImages.has(image)),
    [failedImages, images]
  );

  if (visibleImages.length === 0) return null;

  const shownImages =
    variant === "feed" ? visibleImages.slice(0, 4) : visibleImages;
  const extraCount = visibleImages.length - shownImages.length;
  const isSingle = shownImages.length === 1;

  return (
    <div
      className={
        isSingle
          ? "grid grid-cols-1 gap-2"
          : "grid grid-cols-2 gap-2 sm:gap-3"
      }
    >
      {shownImages.map((image, index) => (
        <button
          key={`${image}-${index}`}
          type="button"
          className="group relative block overflow-hidden rounded-lg bg-muted text-left"
          aria-label="查看图片"
          onClick={(event) => {
            event.stopPropagation();
            onOpenImage?.(image);
          }}
        >
          <img
            src={image}
            alt={`帖子图片 ${index + 1}`}
            className={
              variant === "detail"
                ? isSingle
                  ? "aspect-[16/10] max-h-[560px] w-full object-cover"
                  : "aspect-square w-full object-cover"
                : isSingle
                  ? "aspect-[16/9] w-full object-cover"
                  : "aspect-square w-full object-cover"
            }
            loading="lazy"
            onError={() =>
              setFailedImages((current) => new Set(current).add(image))
            }
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
            <span className="rounded-full bg-black/55 p-2 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <ZoomIn className="h-5 w-5" />
            </span>
          </div>
          {extraCount > 0 && index === shownImages.length - 1 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-xl font-semibold text-white">
              +{extraCount}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
