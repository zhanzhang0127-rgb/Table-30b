import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Globe,
  Heart,
  MapPin,
  Phone,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const ratingValue = (value: unknown) => {
  const parsed = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
};

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-5 w-5 ${
            rating >= star
              ? "fill-accent text-accent"
              : "text-muted-foreground/40"
          }`}
        />
      ))}
    </div>
  );
}

export default function RestaurantDetail() {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const match = window.location.pathname.match(/\/restaurant\/(\d+)/);
    if (match) {
      setRestaurantId(Number.parseInt(match[1], 10));
    }
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  const { data: restaurant, isLoading } = trpc.restaurants.getById.useQuery(
    restaurantId || 0,
    { enabled: restaurantId !== null && isAuthenticated }
  );

  const { data: myFavorites } = trpc.favorites.getMyFavorites.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  useEffect(() => {
    if (!myFavorites || !restaurantId) return;
    setIsFavorite(
      (myFavorites as Array<{ restaurantId: number }>).some(
        (item) => item.restaurantId === restaurantId
      )
    );
  }, [myFavorites, restaurantId]);

  const addFavoriteMutation = trpc.favorites.add.useMutation({
    onSuccess: () => toast.success(t("restaurants.toastFavAdded")),
    onError: () => toast.error(t("restaurants.toastFavFailed")),
  });

  const removeFavoriteMutation = trpc.favorites.remove.useMutation({
    onSuccess: () => toast.success(t("restaurants.toastFavRemoved")),
    onError: () => toast.error(t("restaurants.toastRemoveFavFailed")),
  });

  const rating = useMemo(
    () => ratingValue((restaurant as any)?.averageRating),
    [restaurant]
  );

  const handleToggleFavorite = () => {
    if (!restaurantId) return;

    if (isFavorite) {
      removeFavoriteMutation.mutate(restaurantId);
      setIsFavorite(false);
    } else {
      addFavoriteMutation.mutate(restaurantId);
      setIsFavorite(true);
    }
  };

  if (loading || !isAuthenticated || isLoading || restaurantId === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container py-8">
          <div className="mx-auto max-w-2xl rounded-lg border bg-card p-12 text-center shadow-sm">
            <UtensilsCrossed className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <p className="mb-4 text-muted-foreground">{t("restaurantDetail.notFound")}</p>
            <Button onClick={() => navigate("/restaurants")}>{t("restaurantDetail.back")}</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-6">
        <div className="mx-auto max-w-5xl space-y-5">
          <Button
            variant="ghost"
            className="px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={() => navigate("/restaurants")}
          >
            <ArrowLeft className="h-4 w-4" />
            {t("restaurantDetail.back")}
          </Button>

          <Card className="gap-0 overflow-hidden py-0">
            <div className="relative h-72 bg-muted sm:h-96">
              {(restaurant as any).image ? (
                <img
                  src={(restaurant as any).image}
                  alt={(restaurant as any).name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <UtensilsCrossed className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white sm:p-7">
                <div className="mb-3 flex flex-wrap gap-2">
                  {(restaurant as any).status &&
                    (restaurant as any).status !== "published" && (
                      <Badge variant="outline" className="border-white/40 bg-white/15 text-white">
                        {(restaurant as any).status}
                      </Badge>
                    )}
                  {(restaurant as any).cuisine && (
                    <Badge className="bg-white text-foreground">
                      {(restaurant as any).cuisine}
                    </Badge>
                  )}
                </div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {(restaurant as any).name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <RatingStars rating={rating} />
                  <span className="font-semibold">
                    {rating > 0 ? rating.toFixed(1) : t("common.noRating")}
                  </span>
                  <span className="text-sm text-white/80">
                    {t("common.reviews", { count: (restaurant as any).totalRatings || 0 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
              <section className="space-y-5 p-5 sm:p-7">
                <div>
                  <h2 className="mb-2 text-xl font-semibold">{t("restaurantDetail.description")}</h2>
                  <p className="leading-7 text-muted-foreground">
                    {(restaurant as any).description || t("restaurantDetail.noDescription")}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(restaurant as any).address && (
                    <div className="rounded-lg border bg-background p-4">
                      <div className="mb-2 flex items-center gap-2 font-medium">
                        <MapPin className="h-4 w-4 text-primary" />
                        {t("restaurantDetail.address")}
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {(restaurant as any).address}
                      </p>
                    </div>
                  )}
                  {(restaurant as any).priceLevel && (
                    <div className="rounded-lg border bg-background p-4">
                      <div className="mb-2 flex items-center gap-2 font-medium">
                        <Star className="h-4 w-4 text-primary" />
                        {t("restaurantDetail.price")}
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {(restaurant as any).priceLevel}
                      </p>
                    </div>
                  )}
                </div>

                {((restaurant as any).latitude || (restaurant as any).longitude) && (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                    <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                      <LocateInfoIcon />
                      {t("restaurantDetail.locationSaved")}
                    </div>
                    {[(restaurant as any).city, (restaurant as any).district]
                      .filter(Boolean)
                      .join(" · ") || t("restaurantDetail.locationInfoSaved")}
                  </div>
                )}
              </section>

              <aside className="border-t p-5 sm:p-7 lg:border-l lg:border-t-0">
                <div className="space-y-3">
                  <Button
                    className="w-full"
                    variant={isFavorite ? "secondary" : "outline"}
                    onClick={handleToggleFavorite}
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        isFavorite ? "fill-current" : ""
                      }`}
                    />
                    {isFavorite ? t("restaurantDetail.favorited") : t("restaurantDetail.favorite")}
                  </Button>
                  <Button className="w-full" onClick={() => navigate("/ai-chat")}>
                    {t("common.aiAsk")}
                  </Button>
                </div>

                <div className="mt-6 space-y-3 text-sm">
                  {(restaurant as any).phone && (
                    <a
                      href={`tel:${(restaurant as any).phone}`}
                      className="flex items-center gap-2 rounded-lg border p-3 transition hover:bg-muted"
                    >
                      <Phone className="h-4 w-4" />
                      {(restaurant as any).phone}
                    </a>
                  )}
                  {(restaurant as any).website && (
                    <a
                      href={(restaurant as any).website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border p-3 transition hover:bg-muted"
                    >
                      <Globe className="h-4 w-4" />
                      <span className="truncate">{(restaurant as any).website}</span>
                    </a>
                  )}
                </div>
              </aside>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

function LocateInfoIcon() {
  return <MapPin className="h-4 w-4 text-primary" />;
}
