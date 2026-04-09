import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Bot, User, Star, MapPin, Phone, Heart } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { mockRestaurants } from "@/lib/mockData";
import { useAuth } from "@/_core/hooks/useAuth";

interface RestaurantRecommendation {
  id: number;
  name: string;
  cuisine: string;
  address: string;
  rating: number;
  totalRatings: number;
  priceLevel: string;
  image: string;
  description: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content?: string;
  recommendations?: RestaurantRecommendation[];
  timestamp: Date;
}

export default function AiChat() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "你好！👋 我是吃了吗AI助手。我可以根据你的口味偏好、预算、用餐场景等信息，为你推荐最适合的餐厅。\n\n请告诉我：\n• 你想吃什么菜系？\n• 你的预算范围是多少？\n• 用餐场景是什么？（约会、家庭聚餐、商务宴请等）\n• 你所在的城市或地区？",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [favorites, setFavorites] = useState<number[]>([]);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate AI response with restaurant recommendations
    setTimeout(() => {
      const responseType = Math.floor(Math.random() * 2); // Changed from 3 to 2 to ensure recommendations appear more often
      let assistantMessage: Message;

      if (true) { // Always show recommendations
        // Response with restaurant recommendations
        const recommendations: RestaurantRecommendation[] = [
          mockRestaurants[0],
          mockRestaurants[1],
          mockRestaurants[2],
        ].map(r => ({
          id: r.id,
          name: r.name,
          cuisine: r.cuisine,
          address: r.address,
          rating: parseFloat(r.averageRating),
          totalRatings: r.totalRatings,
          priceLevel: r.priceLevel,
          image: r.image,
          description: r.description,
        }));

        assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "根据你的描述，我为你推荐以下几家餐厅：",
          recommendations,
          timestamp: new Date(),
        };
      } else if (responseType === 1) {
        // Response with single recommendation
        const recommendation: RestaurantRecommendation = {
          id: mockRestaurants[0].id,
          name: mockRestaurants[0].name,
          cuisine: mockRestaurants[0].cuisine,
          address: mockRestaurants[0].address,
          rating: parseFloat(mockRestaurants[0].averageRating),
          totalRatings: mockRestaurants[0].totalRatings,
          priceLevel: mockRestaurants[0].priceLevel,
          image: mockRestaurants[0].image,
          description: mockRestaurants[0].description,
        };

        assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "根据你的需求，我最推荐这家餐厅。它完全符合你的需求，环境优雅，菜品精致，性价比也很好。",
          recommendations: [recommendation],
          timestamp: new Date(),
        };
      } else {
        // Text-only response
        assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "太好了！我已经为你整理了推荐列表。你可以点击\"收藏\"保存喜欢的餐厅，或者告诉我更多关于你的偏好，我会继续为你推荐。",
          timestamp: new Date(),
        };
      }

      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const toggleFavorite = (restaurantId: number) => {
    setFavorites(prev =>
      prev.includes(restaurantId)
        ? prev.filter(id => id !== restaurantId)
        : [...prev, restaurantId]
    );
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <img 
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663506480782/XzEWDxgSS5RTJYj5etncA4/chileoma-logo-J5D7zC5YTWiDqDhd7fMXt5.webp" 
              alt="吃了吗 Logo" 
              className="h-10 w-10"
            />
            <span className="text-xl font-bold text-primary">吃了吗</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="/" className="text-foreground/70 hover:text-foreground transition-colors">首页</a>
            <a href="/feed" className="text-foreground/70 hover:text-foreground transition-colors">社区</a>
            <a href="/rankings" className="text-foreground/70 hover:text-foreground transition-colors">排行榜</a>
            <a href="/ai-chat" className="text-foreground font-medium">AI助手</a>
          </nav>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/profile")}
            >
              个人中心
            </Button>
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <main className="flex-1 container py-8 flex flex-col">
        <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto mb-6 space-y-6 pr-4">
            {messages.map((message) => (
              <div key={message.id}>
                {/* Message bubble */}
                <div
                  className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                  )}

                  {message.content && (
                    <Card className={`max-w-lg p-4 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-foreground"
                    }`}>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                      <p className={`text-xs mt-2 ${
                        message.role === "user"
                          ? "text-primary-foreground/70"
                          : "text-foreground/60"
                      }`}>
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </Card>
                  )}

                  {message.role === "user" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-secondary" />
                    </div>
                  )}
                </div>

                {/* Restaurant recommendations */}
                {message.recommendations && message.recommendations.length > 0 && (
                  <div className="mt-4 ml-11 space-y-3">
                    {message.recommendations.map((restaurant) => (
                      <Card key={restaurant.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <div className="flex flex-col md:flex-row">
                          {/* Image */}
                          <div className="md:w-48 h-40 md:h-auto flex-shrink-0">
                            <img
                              src={restaurant.image}
                              alt={restaurant.name}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          {/* Content */}
                          <div className="flex-1 p-4 flex flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h3 className="text-lg font-bold text-foreground">{restaurant.name}</h3>
                                  <p className="text-sm text-foreground/60 mt-1">{restaurant.cuisine}</p>
                                </div>
                                <span className="text-sm font-semibold px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                                  {restaurant.priceLevel}
                                </span>
                              </div>

                              <p className="text-sm text-foreground/70 mb-3 line-clamp-2">
                                {restaurant.description}
                              </p>

                              {/* Rating */}
                              <div className="flex items-center gap-3 mb-3">
                                <div className="flex items-center gap-1">
                                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                  <span className="text-sm font-semibold text-foreground">
                                    {restaurant.rating}
                                  </span>
                                  <span className="text-xs text-foreground/60">
                                    ({restaurant.totalRatings}条评价)
                                  </span>
                                </div>
                              </div>

                              {/* Address */}
                              <div className="flex items-start gap-2 text-sm text-foreground/70 mb-3">
                                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{restaurant.address}</span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-3 border-t border-border">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => toggleFavorite(restaurant.id)}
                              >
                                <Heart
                                  className={`w-4 h-4 mr-1 ${
                                    favorites.includes(restaurant.id)
                                      ? "fill-red-500 text-red-500"
                                      : ""
                                  }`}
                                />
                                {favorites.includes(restaurant.id) ? "已收藏" : "收藏"}
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                查看详情
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <Card className="bg-muted/50 p-4">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                    <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  </div>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="flex gap-3">
            <Input
              placeholder="告诉我你想吃什么..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !isLoading) {
                  handleSendMessage();
                }
              }}
              disabled={isLoading}
              className="flex-1 bg-muted/50 border-border"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
