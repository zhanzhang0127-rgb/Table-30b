import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Heart,
  LocateFixed,
  MapPin,
  Plus,
  Search,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type NearbyParams = {
  latitude: number;
  longitude: number;
  radiusKm: number;
};

const ratingValue = (value: unknown) => {
  const parsed = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
};

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            rating >= star
              ? "fill-accent text-accent"
              : "text-muted-foreground/40"
          }`}
        />
      ))}
    </div>
  );
}

export default function Restaurants() {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [searchText, setSearchText] = useState("");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [nearbyParams, setNearbyParams] = useState<NearbyParams | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  const directoryQuery = trpc.restaurants.getDirectory.useQuery(
    { limit: 100, offset: 0 },
    { enabled: isAuthenticated }
  );

  const nearbyQuery = trpc.restaurants.getNearby.useQuery(
    {
      latitude: nearbyParams?.latitude || 0,
      longitude: nearbyParams?.longitude || 0,
      radiusKm: nearbyParams?.radiusKm || 5,
      limit: 50,
    },
    { enabled: isAuthenticated && nearbyParams !== null }
  );

  const { data: myFavorites } = trpc.favorites.getMyFavorites.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  useEffect(() => {
    if (myFavorites) {
      setFavorites(
        new Set((myFavorites as Array<{ restaurantId: number }>).map((item) => item.restaurantId))
      );
    }
  }, [myFavorites]);

  const restaurants = useMemo(() => {
    const base = nearbyParams
      ? ((nearbyQuery.data as any[]) || [])
      : ((directoryQuery.data as any[]) || []);

    const query = searchText.trim().toLowerCase();
    if (!query) return base;

    return base.filter((restaurant) =>
      [
        restaurant.name,
        restaurant.cuisine,
        restaurant.address,
        restaurant.city,
        restaurant.district,
        restaurant.priceLevel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [directoryQuery.data, nearbyParams, nearbyQuery.data, searchText]);

  const addFavoriteMutation = trpc.favorites.add.useMutation({
    onSuccess: () => {
      toast.success(t("restaurants.toastFavAdded"));
    },
    onError: () => {
      toast.error(t("restaurants.toastFavFailed"));
    },
  });

  const removeFavoriteMutation = trpc.favorites.remove.useMutation({
    onSuccess: () => {
      toast.success(t("restaurants.toastFavRemoved"));
    },
    onError: () => {
      toast.error(t("restaurants.toastRemoveFavFailed"));
    },
  });

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t("restaurants.toastNoGeo"));
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNearbyParams({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          radiusKm: 5,
        });
        setIsLocating(false);
        toast.success(t("restaurants.toastLocated"));
      },
      () => {
        setIsLocating(false);
        toast.error(t("restaurants.toastLocationFailed"));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  };

  const handleToggleFavorite = (restaurantId: number) => {
    if (favorites.has(restaurantId)) {
      removeFavoriteMutation.mutate(restaurantId);
      setFavorites((prev) => {
        const next = new Set(prev);
        next.delete(restaurantId);
        return next;
      });
    } else {
      addFavoriteMutation.mutate(restaurantId);
      setFavorites((prev) => new Set(prev).add(restaurantId));
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  const isLoading = nearbyParams ? nearbyQuery.isLoading : directoryQuery.isLoading;

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8">
        <div className="mx-auto max-w-6xl">
          <Card className="mb-6 gap-0 p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{t("restaurants.title")}</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("restaurants.subtitle")}
                </p>
              </div>
              <Button onClick={() => navigate("/submit-restaurant")}>
                <Plus className="h-4 w-4" />
                {t("restaurants.submit")}
              </Button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("restaurants.searchPlaceholder")}
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
              >
                {isLocating ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <LocateFixed className="h-4 w-4" />
                )}
                {t("restaurants.locate")}
              </Button>
              {nearbyParams && (
                <Button variant="ghost" onClick={() => setNearbyParams(null)}>
                  {t("restaurants.viewAll")}
                </Button>
              )}
            </div>

            {nearbyParams && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t("restaurants.viewingNearby", { radius: nearbyParams.radiusKm })}</span>
              </div>
            )}
          </Card>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            </div>
          ) : restaurants.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {restaurants.map((restaurant) => {
                const rating = ratingValue(restaurant.averageRating);
                const isFavorite = favorites.has(restaurant.id);
                return (
                  <Card
                    key={restaurant.id}
                    className="gap-0 overflow-hidden py-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {restaurant.image ? (
                      <img
                        src={restaurant.image}
                        alt={restaurant.name}
                        className="h-44 w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-44 items-center justify-center bg-muted">
                        <UtensilsCrossed className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}

                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="truncate text-lg font-semibold">
                              {restaurant.name}
                            </h2>
                            {restaurant.status && restaurant.status !== "published" && (
                              <Badge variant="outline">{restaurant.status}</Badge>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {[restaurant.cuisine, restaurant.city, restaurant.district]
                              .filter(Boolean)
                              .join(" · ") || t("common.unclassified")}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleToggleFavorite(restaurant.id)}
                          title={isFavorite ? t("restaurants.unfavorite") : t("restaurants.favorite")}
                        >
                          <Heart
                            className={`h-5 w-5 ${
                              isFavorite ? "fill-destructive text-destructive" : ""
                            }`}
                          />
                        </Button>
                      </div>

                      <div className="mb-3 flex items-center gap-2">
                        <RatingStars rating={rating} />
                        <span className="text-sm font-semibold">
                          {rating > 0 ? rating.toFixed(1) : t("common.noRating")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({restaurant.totalRatings || 0})
                        </span>
                      </div>

                      {restaurant.description && (
                        <p className="mb-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {restaurant.description}
                        </p>
                      )}

                      <div className="mt-auto space-y-2 text-sm text-muted-foreground">
                        {restaurant.address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                            <span className="line-clamp-2">{restaurant.address}</span>
                          </div>
                        )}
                        {restaurant.distance !== undefined && (
                          <Badge variant="secondary">
                            {t("common.aboutKm", {
                              distance: Number(restaurant.distance).toFixed(1),
                            })}
                          </Badge>
                        )}
                        {restaurant.priceLevel && (
                          <p>
                            <span className="text-muted-foreground">{t("common.perPerson")}</span>
                            <span className="font-medium text-foreground">
                              {restaurant.priceLevel}
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="mt-5 flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                        >
                          {t("common.viewDetails")}
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={() => navigate("/ai-chat")}
                        >
                          {t("common.aiRecommend")}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <UtensilsCrossed className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <p className="mb-2 font-medium">{t("restaurants.emptyTitle")}</p>
              <p className="mb-5 text-sm text-muted-foreground">
                {nearbyParams
                  ? t("restaurants.emptyNearby")
                  : t("restaurants.emptySearch")}
              </p>
              <Button onClick={() => navigate("/submit-restaurant")}>
                <Plus className="h-4 w-4" />
                {t("restaurants.submit")}
              </Button>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
