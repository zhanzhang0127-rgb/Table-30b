import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sprout, AlertTriangle, Flame, Star, Coins, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { CUISINES, getCuisineLabel, type Cuisine } from "@shared/cuisine";
import { PRICE_RANGES, type PriceRange } from "@shared/priceRange";
import { useT } from "@/contexts/I18nContext";

type MainTab = "general" | "category" | "warning";
type GeneralSection = "weeklyHot" | "taste" | "value";

type RankedPost = {
  id: number;
  userId: number;
  title: string;
  content: string | null;
  images: string | null;
  rating: number | null;
  postType: string;
  tasteRating: number | null;
  valueRating: number | null;
  location: string | null;
  likes: number | null;
  comments: number | null;
  createdAt: Date | string;
  userName: string | null;
  cuisine: string | null;
  pricePerPerson: string | null;
  restaurantHint: string | null;
};

function getRankBadge(index: number) {
  if (index === 0) return { emoji: "🥇", bg: "bg-yellow-100 text-yellow-700" };
  if (index === 1) return { emoji: "🥈", bg: "bg-gray-100 text-gray-600" };
  if (index === 2) return { emoji: "🥉", bg: "bg-orange-100 text-orange-700" };
  return { emoji: String(index + 1), bg: "bg-primary/10 text-primary" };
}

function getFirstImage(images: string | null): string | null {
  if (!images) return null;
  try {
    const arr = JSON.parse(images) as string[];
    return arr[0] ?? null;
  } catch {
    return null;
  }
}

function PostCard({ post, rank, onClick }: { post: RankedPost; rank: number; onClick: () => void }) {
  const badge = getRankBadge(rank);
  const firstImage = getFirstImage(post.images);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card hover:shadow-md transition-shadow p-4 flex items-start gap-3"
    >
      {/* Rank badge */}
      <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${badge.bg}`}>
        {badge.emoji}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm leading-snug line-clamp-2 mb-1">{post.title}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/55">
          {post.tasteRating !== null && (
            <span>😋 {post.tasteRating}</span>
          )}
          {post.valueRating !== null && (
            <span>💰 {post.valueRating}</span>
          )}
          {post.pricePerPerson && post.pricePerPerson !== '不想透露' && (
            <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full">{post.pricePerPerson}</span>
          )}
          {post.location && (
            <span className="truncate max-w-[120px]">📍 {post.location}</span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-foreground/40">
          <span>@{post.userName ?? '匿名'}</span>
          <span>·</span>
          <span>👍 {post.likes ?? 0}</span>
          <span>💬 {post.comments ?? 0}</span>
        </div>
      </div>

      {/* Thumbnail */}
      {firstImage && (
        <img
          src={firstImage}
          alt=""
          className="flex-shrink-0 w-16 h-16 object-cover rounded-lg"
          loading="lazy"
        />
      )}
    </button>
  );
}

function EmptyState({ message, cta, ctaHref, navigate }: {
  message: string;
  cta: string;
  ctaHref: string;
  navigate: (path: string) => void;
}) {
  return (
    <div className="text-center py-10 px-4">
      <Sprout className="w-10 h-10 text-green-300 mx-auto mb-3" />
      <p className="text-sm text-foreground/60 mb-4">{message}</p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => navigate(ctaHref)}
        className="gap-1"
      >
        {cta}
        <ChevronRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function RankingSection({
  title,
  icon,
  posts,
  isLoading,
  navigate,
  emptyMessage,
  emptyCtaHref = "/publish",
}: {
  title: string;
  icon: React.ReactNode;
  posts: RankedPost[] | undefined;
  isLoading: boolean;
  navigate: (path: string) => void;
  emptyMessage: string;
  emptyCtaHref?: string;
}) {
  const { t } = useT();
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="font-bold text-foreground">{title}</h2>
        {posts && posts.length > 0 && (
          <span className="text-xs text-foreground/40 ml-auto">{t('rankings.basedOn', { count: posts.length })}</span>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : posts && posts.length > 0 ? (
        <div className="space-y-2">
          {posts.map((post, i) => (
            <PostCard key={post.id} post={post} rank={i} onClick={() => navigate(`/post/${post.id}`)} />
          ))}
        </div>
      ) : (
        <EmptyState message={emptyMessage} cta={t('rankings.goPost')} ctaHref={emptyCtaHref} navigate={navigate} />
      )}
      {posts && posts.length > 0 && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => navigate("/publish")}
            className="text-xs text-foreground/40 hover:text-foreground/60 transition-colors"
          >
            {t('rankings.growingCta')}
          </button>
        </div>
      )}
    </div>
  );
}

function GeneralTab({ navigate }: { navigate: (path: string) => void }) {
  const [priceFilter, setPriceFilter] = useState<PriceRange | undefined>(undefined);
  const { t } = useT();

  const weeklyHot = trpc.rankings.getByDimension.useQuery({ dimension: 'weeklyHot', limit: 5 });
  const taste = trpc.rankings.getByDimension.useQuery({ dimension: 'taste', limit: 5 });
  const value = trpc.rankings.getByDimension.useQuery({ dimension: 'value', limit: 5, priceRange: priceFilter });

  return (
    <div>
      <RankingSection
        title={t('rankings.sectionWeeklyHot')}
        icon={<Flame className="w-4 h-4 text-orange-500" />}
        posts={weeklyHot.data?.posts}
        isLoading={weeklyHot.isLoading}
        navigate={navigate}
        emptyMessage={t('rankings.emptyWeeklyHot')}
      />
      <RankingSection
        title={t('rankings.sectionTaste')}
        icon={<Star className="w-4 h-4 text-yellow-500" />}
        posts={taste.data?.posts}
        isLoading={taste.isLoading}
        navigate={navigate}
        emptyMessage={t('rankings.emptyTaste')}
      />

      {/* Value ranking with price filter */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Coins className="w-4 h-4 text-green-600" />
          <h2 className="font-bold text-foreground">{t('rankings.sectionValue')}</h2>
          {value.data?.posts && value.data.posts.length > 0 && (
            <span className="text-xs text-foreground/40 ml-auto">{t('rankings.basedOn', { count: value.data.posts.length })}</span>
          )}
        </div>
        {/* Price filter chips */}
        <div className="flex gap-2 flex-wrap mb-3">
          <button
            type="button"
            onClick={() => setPriceFilter(undefined)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${!priceFilter ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground/60 hover:border-foreground/30'}`}
          >
            {t('rankings.priceAll')}
          </button>
          {(['<¥15', '¥15-30', '¥30-50'] as PriceRange[]).map(range => (
            <button
              key={range}
              type="button"
              onClick={() => setPriceFilter(range === priceFilter ? undefined : range)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${priceFilter === range ? 'bg-green-600 text-white border-green-600' : 'border-border text-foreground/60 hover:border-foreground/30'}`}
            >
              {range}
            </button>
          ))}
        </div>
        {value.isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : value.data?.posts && value.data.posts.length > 0 ? (
          <div className="space-y-2">
            {value.data.posts.map((post, i) => (
              <PostCard key={post.id} post={post} rank={i} onClick={() => navigate(`/post/${post.id}`)} />
            ))}
          </div>
        ) : (
          <EmptyState
            message={priceFilter ? t('rankings.emptyValueRange', { range: priceFilter }) : t('rankings.emptyValue')}
            cta={t('rankings.goPost')}
            ctaHref="/publish"
            navigate={navigate}
          />
        )}
        {value.data?.posts && value.data.posts.length > 0 && (
          <div className="mt-3 text-center">
            <button type="button" onClick={() => navigate("/publish")} className="text-xs text-foreground/40 hover:text-foreground/60 transition-colors">
              {t('rankings.growingCta')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryTab({ navigate }: { navigate: (path: string) => void }) {
  const [selectedCuisine, setSelectedCuisine] = useState<Cuisine>(CUISINES[0]);
  const { t, lang } = useT();
  const cuisinePosts = trpc.rankings.getByDimension.useQuery({
    dimension: 'cuisine',
    cuisine: selectedCuisine,
    limit: 5,
  });

  return (
    <div>
      {/* Cuisine chips */}
      <div className="flex gap-2 flex-wrap mb-4">
        {CUISINES.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setSelectedCuisine(c)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${selectedCuisine === c ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground/60 hover:border-foreground/30'}`}
          >
            {getCuisineLabel(c, lang)}
          </button>
        ))}
      </div>

      {/* Posts for selected cuisine */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-foreground">{t('rankings.categoryHot', { label: getCuisineLabel(selectedCuisine, lang) })}</h2>
        {cuisinePosts.data?.posts && cuisinePosts.data.posts.length > 0 && (
          <span className="text-xs text-foreground/40">{t('rankings.basedOn', { count: cuisinePosts.data.posts.length })}</span>
        )}
      </div>

      {cuisinePosts.isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : cuisinePosts.data?.posts && cuisinePosts.data.posts.length > 0 ? (
        <>
          <div className="space-y-2">
            {cuisinePosts.data.posts.map((post, i) => (
              <PostCard key={post.id} post={post} rank={i} onClick={() => navigate(`/post/${post.id}`)} />
            ))}
          </div>
          <div className="mt-3 text-center">
            <button type="button" onClick={() => navigate("/publish")} className="text-xs text-foreground/40 hover:text-foreground/60 transition-colors">
              {t('rankings.growingCta')}
            </button>
          </div>
        </>
      ) : (
        <EmptyState
          message={t('rankings.emptyCategory', { label: getCuisineLabel(selectedCuisine, lang) })}
          cta={t('rankings.goPost')}
          ctaHref="/publish"
          navigate={navigate}
        />
      )}
    </div>
  );
}

function WarningTab({ navigate }: { navigate: (path: string) => void }) {
  const warning = trpc.rankings.getByDimension.useQuery({ dimension: 'warning', limit: 5 });
  const { t } = useT();

  return (
    <div>
      <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
        <p className="text-xs text-amber-700 leading-relaxed">{t('rankings.warningDisclaimer')}</p>
      </div>

      {warning.isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : warning.data?.posts && warning.data.posts.length > 0 ? (
        <>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="font-bold text-foreground">{t('rankings.warningTitle')}</h2>
            <span className="text-xs text-foreground/40 ml-auto">{t('rankings.basedOn', { count: warning.data.posts.length })}</span>
          </div>
          <div className="space-y-2">
            {warning.data.posts.map((post, i) => (
              <PostCard key={post.id} post={post} rank={i} onClick={() => navigate(`/post/${post.id}`)} />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <span className="text-4xl mb-4 block">✨</span>
          <p className="text-sm font-medium text-foreground/70 mb-2">{t('rankings.warningEmptyTitle')}</p>
          <p className="text-xs text-foreground/45 mb-5">{t('rankings.warningEmptySubtitle')}</p>
          <button
            type="button"
            onClick={() => navigate("/publish")}
            className="text-xs text-foreground/40 hover:text-foreground/60 border border-border rounded-full px-4 py-2 transition-colors"
          >
            {t('rankings.warningEmptyCta')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Rankings() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<MainTab>("general");
  const { t } = useT();

  const tabs: Array<{ value: MainTab; label: string }> = [
    { value: "general", label: t('rankings.tabGeneral') },
    { value: "category", label: t('rankings.tabCategory') },
    { value: "warning", label: t('rankings.tabWarning') },
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sprout className="w-6 h-6 text-green-500" />
            {t('rankings.pageTitle')}
          </h1>
          <p className="text-sm text-foreground/50 mt-1">{t('rankings.subtitle')}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-border">
          {tabs.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.value
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground/50 hover:text-foreground/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "general" && <GeneralTab navigate={navigate} />}
        {activeTab === "category" && <CategoryTab navigate={navigate} />}
        {activeTab === "warning" && <WarningTab navigate={navigate} />}
      </main>
    </div>
  );
}
