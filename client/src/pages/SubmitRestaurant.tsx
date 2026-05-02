import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { isLocalPreviewHost } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  CheckCircle,
  ChevronLeft,
  LocateFixed,
  Loader2,
  MapPin,
  Star,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

type RestaurantLocation = {
  latitude: number;
  longitude: number;
  city?: string;
  district?: string;
};

export default function SubmitRestaurant() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const isLocalPreview = isLocalPreviewHost();
  const canViewForm = isAuthenticated || isLocalPreview;

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [priceLevel, setPriceLevel] = useState("");
  const [rating, setRating] = useState(0);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<RestaurantLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitRestaurant = trpc.restaurants.submit.useMutation();
  const reverseGeocode = trpc.restaurants.reverseGeocode.useMutation();

  const resetForm = () => {
    setName("");
    setAddress("");
    setPriceLevel("");
    setRating(0);
    setDescription("");
    setLocation(null);
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t("submitRestaurant.toastNoGeo"));
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        try {
          const result = await reverseGeocode.mutateAsync(nextLocation);
          setAddress(result.address || address);
          setLocation({
            ...nextLocation,
            city: result.city || undefined,
            district: result.district || undefined,
          });
          toast.success(t("submitRestaurant.toastLocated"));
        } catch {
          setLocation(nextLocation);
          toast.warning(t("submitRestaurant.toastLocationPartial"));
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
        toast.error(t("submitRestaurant.toastLocationFailed"));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("submitRestaurant.toastImageTooLarge"));
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const base64 = readerEvent.target?.result as string;
      setImagePreview(base64);
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      toast.error(t("submitRestaurant.toastNameRequired"));
      return;
    }
    if (!address.trim()) {
      toast.error(t("submitRestaurant.toastAddressRequired"));
      return;
    }
    if (!priceLevel.trim()) {
      toast.error(t("submitRestaurant.toastPriceRequired"));
      return;
    }
    if (rating === 0) {
      toast.error(t("submitRestaurant.toastRatingRequired"));
      return;
    }
    if (!description.trim()) {
      toast.error(t("submitRestaurant.toastDescriptionRequired"));
      return;
    }

    try {
      if (isLocalPreview && !isAuthenticated) {
        toast.success(t("submitRestaurant.toastPreview"));
        setSubmitted(true);
        return;
      }

      await submitRestaurant.mutateAsync({
        name: name.trim(),
        address: address.trim(),
        priceLevel: priceLevel.trim(),
        rating,
        description: description.trim(),
        image: imageBase64 || undefined,
        city: location?.city,
        district: location?.district,
        latitude: location?.latitude,
        longitude: location?.longitude,
      });
      setSubmitted(true);
    } catch (error: any) {
      toast.error(
        t("submitRestaurant.toastSubmitFailed", {
          message: error?.message || t("submitRestaurant.retryLater"),
        })
      );
    }
  };

  const isSubmitDisabled =
    submitRestaurant.isPending ||
    !name.trim() ||
    !address.trim() ||
    !priceLevel.trim() ||
    rating === 0 ||
    !description.trim();

  if (!canViewForm) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="mx-4 w-full max-w-sm">
          <CardContent className="pt-6 text-center">
            <p className="mb-4 text-muted-foreground">{t("submitRestaurant.loginRequired")}</p>
            <Button onClick={() => navigate("/")}>{t("submitRestaurant.goLogin")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="mx-4 w-full max-w-sm">
          <CardContent className="pb-8 pt-8 text-center">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-secondary" />
            <h2 className="mb-2 text-xl font-bold">{t("submitRestaurant.successTitle")}</h2>
            <p className="mb-6 text-muted-foreground">
              {t("submitRestaurant.successBody")}
            </p>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setSubmitted(false);
                  resetForm();
                }}
              >
                {t("submitRestaurant.submitMore")}
              </Button>
              <Button onClick={() => navigate("/restaurants")}>{t("submitRestaurant.viewRestaurants")}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur-md">
        <div className="container flex h-14 items-center gap-3">
          <button
            onClick={() => navigate(-1 as any)}
            className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm">{t("common.back")}</span>
          </button>
          <h1 className="text-lg font-bold">{t("submitRestaurant.backTitle")}</h1>
        </div>
      </div>

      <div className="container max-w-2xl py-8">
        <Card className="border-border/80 shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-8">
              <h2 className="mb-2 text-2xl font-bold">{t("submitRestaurant.heading")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("submitRestaurant.subtitle")}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">
                  {t("submitRestaurant.name")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder={t("submitRestaurant.namePlaceholder")}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="address">
                    {t("submitRestaurant.address")} <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                  >
                    {isLocating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LocateFixed className="h-4 w-4" />
                    )}
                    {t("submitRestaurant.useLocation")}
                  </Button>
                </div>
                <Input
                  id="address"
                  placeholder={t("submitRestaurant.addressPlaceholder")}
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  required
                />
                {location && (
                  <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {t("submitRestaurant.locationSaved")}
                      {[location.city, location.district].filter(Boolean).length > 0
                        ? ` · ${[location.city, location.district].filter(Boolean).join(" ")}`
                        : ""}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="priceLevel">
                    {t("submitRestaurant.price")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="priceLevel"
                    placeholder={t("submitRestaurant.pricePlaceholder")}
                    value={priceLevel}
                    onChange={(event) => setPriceLevel(event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    {t("submitRestaurant.rating")} <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex h-10 items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-accent"
                        onClick={() => setRating(star)}
                        aria-label={t("submitRestaurant.starLabel", { star })}
                      >
                        <Star
                          className={`h-7 w-7 ${
                            rating >= star
                              ? "fill-accent text-accent"
                              : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    ))}
                    {rating > 0 && (
                      <span className="ml-2 text-sm font-medium">{rating}.0</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  {t("submitRestaurant.description")} <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder={t("submitRestaurant.descriptionPlaceholder")}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>{t("submitRestaurant.image")}</Label>
                {imagePreview ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
                    <img
                      src={imagePreview}
                      alt={t("submitRestaurant.previewAlt")}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute right-2 top-2 rounded-full bg-black/55 p-1 text-white transition-colors hover:bg-black/75"
                      aria-label={t("submitRestaurant.removeImage")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <Upload className="h-8 w-8" />
                    <span className="text-sm">{t("submitRestaurant.uploadImage")}</span>
                    <span className="text-xs">{t("submitRestaurant.uploadSupport")}</span>
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

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-800">
                  {t("submitRestaurant.notice")}
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
                {submitRestaurant.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("submitRestaurant.submitting")}
                  </>
                ) : (
                  t("restaurants.submit")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
