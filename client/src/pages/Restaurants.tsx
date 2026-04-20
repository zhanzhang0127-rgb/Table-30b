import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MapPin, Star, Phone, Globe, Heart } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { mockRestaurants } from "@/lib/mockData";

export default function Restaurants() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [city, setCity] = useState("北京");
  const [searchCity, setSearchCity] = useState("北京");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  // Use mock data for demo
  const [restaurants] = useState(mockRestaurants);
  const isLoading = false;

  const addFavoriteMutation = trpc.favorites.add.useMutation({
    onSuccess: () => {
      toast.success("已添加到收藏");
    },
    onError: () => {
      toast.error("添加失败");
    },
  });

  const removeFavoriteMutation = trpc.favorites.remove.useMutation({
    onSuccess: () => {
      toast.success("已从收藏移除");
    },
    onError: () => {
      toast.error("移除失败");
    },
  });

  const handleSearch = () => {
    setSearchCity(city);
  };

  const handleToggleFavorite = (restaurantId: number) => {
    if (favorites.has(restaurantId)) {
      removeFavoriteMutation.mutate(restaurantId);
      setFavorites(prev => {
        const newSet = new Set(prev);
        newSet.delete(restaurantId);
        return newSet;
      });
    } else {
      addFavoriteMutation.mutate(restaurantId);
      setFavorites(prev => new Set(prev).add(restaurantId));
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
      <main className="container py-8">
        <div className="max-w-5xl mx-auto">
          {/* Search Section */}
          <Card className="p-6 mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-6">发现餐厅</h1>
            
            <div className="flex gap-3">
              <Input
                placeholder="输入城市名称..."
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="flex-1 bg-muted/50 border-border"
              />
              <Button 
                onClick={handleSearch}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                搜索
              </Button>
            </div>
          </Card>

          {/* Restaurants Grid */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
            </div>
          ) : restaurants && restaurants.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-6">
              {restaurants.map((restaurant) => (
                <Card key={restaurant.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Restaurant Image */}
                  {restaurant.image && (
                    <img 
                      src={restaurant.image} 
                      alt={restaurant.name}
                      className="w-full h-48 object-cover"
                      loading="lazy"
                    />
                  )}

                  {/* Restaurant Info */}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{restaurant.name}</h3>
                        <p className="text-sm text-foreground/60 mt-1">{restaurant.cuisine}</p>
                      </div>
                      <button
                        onClick={() => handleToggleFavorite(restaurant.id)}
                        className={`transition-colors ${
                          favorites.has(restaurant.id)
                            ? "text-secondary"
                            : "text-muted-foreground hover:text-secondary"
                        }`}
                      >
                        <Heart className="w-6 h-6" fill={favorites.has(restaurant.id) ? "currentColor" : "none"} />
                      </button>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.floor(parseFloat(restaurant.averageRating || "0"))
                                ? "fill-secondary text-secondary"
                                : "text-muted-foreground"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-semibold text-foreground">{restaurant.averageRating}</span>
                      <span className="text-sm text-foreground/60">({restaurant.totalRatings} 评分)</span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-foreground/70 mb-4 line-clamp-2">
                      {restaurant.description}
                    </p>

                    {/* Contact Info */}
                    <div className="space-y-2 mb-4 text-sm text-foreground/70">
                      {restaurant.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>{restaurant.address}</span>
                        </div>
                      )}
                      {restaurant.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          <a href={`tel:${restaurant.phone}`} className="hover:text-primary">
                            {restaurant.phone}
                          </a>
                        </div>
                      )}
                      {restaurant.website && (
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          <a href={restaurant.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary truncate">
                            {restaurant.website}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Price Level */}
                    {restaurant.priceLevel && (
                      <div className="mb-4 text-sm">
                        <span className="text-foreground/60">价格段：</span>
                        <span className="font-semibold text-foreground ml-1">{restaurant.priceLevel}</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate(`/restaurants/${restaurant.id}`)}
                      >
                        查看详情
                      </Button>
                      <Button 
                        className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => navigate("/ai-chat")}
                      >
                        AI推荐
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-foreground/70 mb-4">该城市暂无餐厅数据</p>
              <p className="text-sm text-foreground/60">请尝试搜索其他城市或稍后再试</p>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
