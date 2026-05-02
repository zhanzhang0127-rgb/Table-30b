import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { Send, Loader2, Bot, User, Sparkles, MapPin, MapPinOff } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface UserLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

const QUICK_PROMPT_KEYS = [
  "ai.promptTaste",
  "ai.promptNearby",
  "ai.promptHot",
  "ai.promptDate",
];

export default function AiChat() {
  const { isAuthenticated, loading } = useAuth();
  const { language, t } = useLanguage();
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t("ai.welcome"),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [conversationHistory, setConversationHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const reverseGeocode = trpc.restaurants.reverseGeocode.useMutation();

  const chatMutation = trpc.aiRecommendations.chat.useMutation({
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setConversationHistory((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    },
    onError: (error) => {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: t("ai.error", { message: error.message }),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0]?.id !== "welcome") return current;
      return [{ ...current[0], content: t("ai.welcome") }];
    });
  }, [t]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t("ai.toastNoGeo"));
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let address: string | undefined;
        try {
          const result = await reverseGeocode.mutateAsync({ latitude: lat, longitude: lng });
          address = result.address;
        } catch {
          // 高德解析失败也没关系，定位仍然有效。
        }
        setUserLocation({ latitude: lat, longitude: lng, address });
        setLocationLoading(false);
        // 自动发一条提示消息
        const locMsg = address
          ? t("ai.locationMessageWithAddress", { address })
          : t("ai.locationMessage");
        const sysMsg: Message = {
          id: `loc-${Date.now()}`,
          role: "assistant",
          content: `📍 ${locMsg}\n\n${t("ai.locationAssistantHint")}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, sysMsg]);
        toast.success(
          address
            ? t("ai.toastLocationSuccessWithAddress", { address })
            : t("ai.toastLocationSuccess")
        );  
      },
      (err) => {
        setLocationLoading(false);
          toast.error(err.code === 1 ? t("ai.toastLocationPermission") : t("ai.toastLocationFailed"));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleClearLocation = () => {
    setUserLocation(null);
    toast(t("ai.toastLocationClosed"));
  };

  const sendMessage = (text: string) => {
    if (!text.trim() || chatMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    // 先构建新历史，再发送（避免状态时序问题）
    const newHistory = [...conversationHistory, { role: "user" as const, content: text }];
    setMessages((prev) => [...prev, userMessage]);
    setConversationHistory(newHistory);
    setInput("");

    chatMutation.mutate({
      message: text,
      conversationHistory: newHistory.slice(0, -1), // 不包含当前消息，已单独传入 message
      userLocation: userLocation ?? undefined,
    });
  };

  const handleSend = () => sendMessage(input);

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 container py-6 flex flex-col">
        <div className="max-w-3xl mx-auto w-full flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-foreground flex items-center gap-2">
                  {t("ai.title")}
                  <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {t("ai.powered")}
                  </span>
                </h1>
                <p className="text-xs text-foreground/60">{t("ai.subtitle")}</p>
              </div>
            </div>

            {/* 位置状态按钮 */}
            {userLocation ? (
              <button
                onClick={handleClearLocation}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {userLocation.address ? userLocation.address.slice(0, 10) + "…" : t("ai.locationShared")}
                </span>
                <span className="sm:hidden">{t("ai.locatedShort")}</span>
              </button>
            ) : (
              <button
                onClick={handleGetLocation}
                disabled={locationLoading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-foreground/60 hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                {locationLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MapPinOff className="w-3.5 h-3.5" />
                )}
                <span>{locationLoading ? t("ai.locating") : t("ai.getLocation")}</span>
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mt-1">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                )}

                <Card
                  className={`max-w-[75%] p-4 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                  <p
                    className={`text-xs mt-2 ${
                      message.role === "user"
                        ? "text-primary-foreground/70"
                        : "text-foreground/50"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString(language === "zh" ? "zh-CN" : "en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </Card>

                {message.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center mt-1">
                    <User className="w-5 h-5 text-secondary" />
                  </div>
                )}
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <Card className="bg-muted/50 p-4">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                    <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
                    <span className="text-xs text-foreground/50 ml-1">{t("ai.thinking")}</span>
                  </div>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts - show only at start */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {QUICK_PROMPT_KEYS.map((promptKey) => {
                const prompt = t(promptKey);
                return (
                  <button
                    key={promptKey}
                    onClick={() => sendMessage(prompt)}
                    disabled={chatMutation.isPending}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/30 text-foreground/70 hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Input Area */}
          <div className="flex gap-2">
            <Input
              placeholder={userLocation ? t("ai.inputNearby") : t("ai.inputDefault")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !chatMutation.isPending) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={chatMutation.isPending}
              className="flex-1 bg-muted/50 border-border"
              maxLength={500}
            />
            <Button
              onClick={handleSend}
              disabled={chatMutation.isPending || !input.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
              {chatMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-foreground/40 text-center mt-2">
            {userLocation
              ? t("ai.footerLocation")
              : t("ai.footerDefault")}
          </p>
        </div>
      </main>
    </div>
  );
}
