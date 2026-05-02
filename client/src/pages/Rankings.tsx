import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  LocateFixed,
  MapPin,
  Search,
  Star,
  Trophy,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type NearbyParams = {
  latitude: number;
  longitude: number;
  radiusKm: number;
};

const radiusOptions = [1, 3, 5, 10];

const ratingValue = (value: unknown) => {
  const parsed = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
};

const scoreForRestaurant = (restaurant: any) => {
  const rating = ratingValue(restaurant.averageRating);
  const totalRatings = Number(restaurant.totalRatings || 0);
  const popularityBoost = Math.min(totalRatings, 50) / 100;
  const distancePenalty =
    restaurant.distance === undefined ? 0 : Math.min(Number(restaurant.distance), 10) / 20;
  return Math.max(0, rating + popularityBoost - distancePenalty);
};

function RankBadge({ index }: { index: number }) {
  const rank = index + 1;
  const styles =
    rank === 1
      ? "bg-accent text-accent-foreground"
      : rank === 2
        ? "bg-muted text-foreground"
        : rank === 3
          ? "bg-secondary text-secondary-foreground"
          : "bg-primary/10 text-primary";

  return (
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-bold ${styles}`}>
      {rank}
    </div>
  );
}

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

export default function Rankings() {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [searchText, setSearchText] = useState("");
  const [nearbyParams, setNearbyParams] = useState<NearbyParams | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/");
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

  const restaurants = useMemo(() => {
    const source = nearbyParams
      ? ((nearbyQuery.data as any[]) || [])
      : ((directoryQuery.data as any[]) || []);

    const query = searchText.trim().toLowerCase();
    const filtered = query
      ? source.filter((restaurant) =>
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
        )
      : source;

    return [...filtered].sort((a, b) => {
      const scoreDiff = scoreForRestaurant(b) - scoreForRestaurant(a);
      if (scoreDiff !== 0) return scoreDiff;
      if (a.distance !== undefined && b.distance !== undefined) {
        return Number(a.distance) - Number(b.distance);
      }
      return ratingValue(b.averageRating) - ratingValue(a.averageRating);
    });
  }, [directoryQuery.data, nearbyParams, nearbyQuery.data, searchText]);

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
          radiusKm: nearbyParams?.radiusKm || 5,
        });
        setIsLocating(false);
        toast.success(t("rankings.toastLocated"));
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

  const updateRadius = (radiusKm: number) => {
    if (!nearbyParams) return;
    setNearbyParams({ ...nearbyParams, radiusKm });
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
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight md:text-4xl">
                <Trophy className="h-8 w-8 text-accent" />
                {t("rankings.title")}
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("rankings.subtitle")}
              </p>
            </div>
            <Button onClick={handleUseCurrentLocation} disabled={isLocating}>
              {isLocating ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <LocateFixed className="h-4 w-4" />
              )}
              {t("rankings.locate")}
            </Button>
          </div>

          <Card className="mb-6 gap-0 p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={t("rankings.searchPlaceholder")}
                  className="pl-9"
                />
              </div>
              {nearbyParams ? (
                <Button variant="ghost" onClick={() => setNearbyParams(null)}>
                  {t("rankings.viewAll")}
                </Button>
              ) : (
                <Button variant="outline" onClick={() => navigate("/restaurants")}>
                  {t("rankings.restaurantPage")}
                </Button>
              )}
            </div>

            {nearbyParams && (
              <div className="mt-4 flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t("rankings.filtered")}</span>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {radiusOptions.map((radiusKm) => (
                    <Button
                      key={radiusKm}
                      size="sm"
                      variant={
                        nearbyParams.radiusKm === radiusKm ? "default" : "outline"
                      }
                      onClick={() => updateRadius(radiusKm)}
                    >
                      {radiusKm}km
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            </div>
          ) : restaurants.length > 0 ? (
            <div className="space-y-4">
              {restaurants.map((restaurant, index) => {
                const rating = ratingValue(restaurant.averageRating);
                const score = scoreForRestaurant(restaurant);
                return (
                  <Card
                    key={restaurant.id}
                    className="gap-0 overflow-hidden p-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row">
                      {restaurant.image ? (
                        <img
                          src={restaurant.image}
                          alt={restaurant.name}
                          className="h-44 w-full object-cover sm:h-auto sm:w-44"
                        />
                      ) : (
                        <div className="flex h-44 w-full items-center justify-center bg-muted sm:h-auto sm:w-44">
                          <UtensilsCrossed className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}

                      <div className="flex flex-1 items-start gap-4 p-5">
                        <RankBadge index={index} />
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-semibold">
                              {restaurant.name}
                            </h2>
                            {restaurant.status &&
                              restaurant.status !== "published" && (
                                <Badge variant="outline">{restaurant.status}</Badge>
                              )}
                          </div>

                          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                            <RatingStars rating={rating} />
                            <span className="font-semibold">
                              {rating > 0 ? rating.toFixed(1) : t("common.noRating")}
                            </span>
                            <span className="text-muted-foreground">
                              {t("common.reviews", { count: restaurant.totalRatings || 0 })}
                            </span>
                            {restaurant.distance !== undefined && (
                              <Badge variant="secondary">
                                {t("common.aboutKm", {
                                  distance: Number(restaurant.distance).toFixed(1),
                                })}
                              </Badge>
                            )}
                          </div>

                          {restaurant.description && (
                            <p className="mb-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                              {restaurant.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                            {restaurant.address && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {restaurant.address}
                              </span>
                            )}
                            {restaurant.priceLevel && (
                              <span>{t("common.perPerson")}{restaurant.priceLevel}</span>
                            )}
                            {[restaurant.city, restaurant.district]
                              .filter(Boolean)
                              .join(" · ") && (
                              <span>
                                {[restaurant.city, restaurant.district]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="hidden shrink-0 text-right md:block">
                          <p className="text-xs text-muted-foreground">{t("common.score")}</p>
                          <p className="mt-1 text-2xl font-bold">
                            {score.toFixed(1)}
                          </p>
                          <Button
                            className="mt-4"
                            variant="outline"
                            onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                          >
                            {t("common.view")}
                          </Button>
                        </div>
                      </div>

                      <div className="border-t p-4 md:hidden">
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                        >
                          {t("common.viewDetails")}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Trophy className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-60" />
              <p className="mb-2 font-medium">
                {nearbyParams ? t("rankings.emptyNearbyTitle") : t("rankings.emptyTitle")}
              </p>
              <p className="mx-auto mb-6 max-w-md text-sm leading-6 text-muted-foreground">
                {nearbyParams
                  ? t("rankings.emptyNearbyBody")
                  : t("rankings.emptyBody")}
              </p>
              <div className="flex justify-center gap-3">
                <Button onClick={() => navigate("/restaurants")}>{t("rankings.browseRestaurants")}</Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/submit-restaurant")}
                >
                  {t("restaurants.submit")}
                </Button>
              </div>
            </Card>
          )}

          <Card className="mt-8 border-0 bg-muted/30 p-6">
            <h3 className="mb-3 font-semibold">{t("rankings.infoTitle")}</h3>
            <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
              <li>{t("rankings.infoSource")}</li>
              <li>{t("rankings.infoLocation")}</li>
              <li>{t("rankings.infoScore")}</li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}
