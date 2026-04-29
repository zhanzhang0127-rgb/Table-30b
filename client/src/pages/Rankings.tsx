import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

type RankingDimension = 'overall' | 'hotThisWeek' | 'topRated' | 'bestValue' | 'newlyFamous';

const rankingTabs: Array<{ value: RankingDimension; label: string }> = [
  { value: 'overall', label: '综合推荐' },
  { value: 'hotThisWeek', label: '本周最热' },
  { value: 'topRated', label: '评分最高' },
  { value: 'bestValue', label: '性价比之选' },
  { value: 'newlyFamous', label: '新晋口碑' },
];

function getRankLabel(index: number) {
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
  return String(index + 1);
}

export default function Rankings() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [dimension, setDimension] = useState<RankingDimension>('overall');

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  const rankingsQuery = trpc.rankings.getByDimension.useQuery({
    dimension,
    limit: 20,
  });

  const rankings = rankingsQuery.data ?? [];

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
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
              <Trophy className="w-8 h-8 text-secondary" />
              餐厅排行榜
            </h1>
            <p className="text-foreground/70">
              基于真实用户发帖与评分，实时展示校园可信榜单
            </p>
          </div>

          {/* Tabs */}
          <Card className="p-3 mb-6">
            <div className="flex flex-wrap gap-2">
              {rankingTabs.map((tab) => (
                <Button
                  key={tab.value}
                  type="button"
                  variant={dimension === tab.value ? 'default' : 'outline'}
                  onClick={() => setDimension(tab.value)}
                  className={dimension === tab.value ? 'bg-primary text-primary-foreground' : ''}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </Card>

          {/* Rankings List */}
          {rankingsQuery.isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((idx) => (
                <Card key={idx} className="p-6">
                  <div className="animate-pulse flex items-center gap-4">
                    <div className="h-10 w-10 rounded-md bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 rounded bg-muted" />
                      <div className="h-3 w-1/2 rounded bg-muted" />
                    </div>
                    <div className="h-8 w-24 rounded bg-muted" />
                  </div>
                </Card>
              ))}
            </div>
          ) : rankings && rankings.length > 0 ? (
            <div className="space-y-4">
              {rankings.map((ranking, index) => (
                <Card
                  key={ranking.id}
                  className="p-6 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/restaurant/${ranking.id}`)}
                >
                  <div className="flex items-center gap-6">
                    {/* Rank Badge */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${
                      index === 0 ? "bg-yellow-100 text-yellow-700" :
                      index === 1 ? "bg-gray-100 text-gray-700" :
                      index === 2 ? "bg-orange-100 text-orange-700" :
                      "bg-primary/10 text-primary"
                    }`}>
                      {getRankLabel(index)}
                    </div>

                    {/* Restaurant Info */}
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-foreground mb-2">
                        {ranking.name}
                      </h3>
                      <div className="text-sm text-foreground/70">
                        {ranking.cuisine || "未分类"}
                        {ranking.priceLevel ? ` · ${ranking.priceLevel}` : ""}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <div className="text-sm text-foreground/80 mb-1">
                        ★ {Number(ranking.avgRating ?? 0).toFixed(1)}
                      </div>
                      <p className="text-xs text-foreground/60">📝 {Number(ranking.postCount ?? 0)} 条</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-foreground/70 mb-4">暂无数据，快去发帖打卡吧！</p>
              <p className="text-sm text-foreground/60 mb-6">发布并关联餐厅后，会实时进入排行榜计算</p>
              <Button
                onClick={() => navigate('/publish')}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                去发帖
              </Button>
            </Card>
          )}

          {/* Info Card */}
          <Card className="mt-8 p-6 bg-muted/30 border-0">
            <h3 className="font-semibold text-foreground mb-3">📊 排行榜说明</h3>
            <ul className="space-y-2 text-sm text-foreground/70">
              <li>• 综合推荐：0.6 × 平均评分 + 0.4 × ln(帖子数 + 1)</li>
              <li>• 本周最热：近 7 天帖子数优先</li>
              <li>• 评分最高：按平均评分排序</li>
              <li>• 性价比之选：仅统计“便宜”餐厅</li>
              <li>• 新晋口碑：仅统计近 30 天新增餐厅</li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}
