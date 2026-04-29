Plan: 排行榜功能（5 维度 + 强制餐厅关联）
Context
现状：

Rankings.tsx 完全使用 mock 数据，未接任何真实 tRPC 查询
rankings router 只读一张预计算的 rankings 表，无任何聚合逻辑
Publish.tsx 从未让用户选择餐厅，导致所有帖子 restaurantId = null，排行榜无任何真实数据可用
restaurants.averageRating / totalRatings 是 stub 字段，从未被更新
目标：通过两个协同改动让排行榜「活」起来：

发帖时强制关联餐厅（数据来源）
排行榜改为 5 个体验维度，实时从 posts 聚合计算（无需 schema 改动、无需定时任务）
约束：

不改 drizzle schema（无 pnpm db:push），不影响生产数据库
实时计算（Demo 规模：< 50 家餐厅、< 200 条帖子），无需 caching 层
去商业化：排行榜仅由真实用户帖子驱动，无人工干预排序
5 个排行维度定义
Tab	算法	适用场景
综合推荐（默认）	0.6 × avg_rating + 0.4 × ln(post_count + 1)	找真正口碑好的店
本周最热	近 7 天帖子数 desc	找当前大家都在说的店
评分最高	avg(post.rating) desc，至少 1 条帖	找品质最高的店
性价比之选	仅 priceLevel='便宜'，按 avg_rating desc	找学生党最划算的店
新晋口碑	餐厅加入平台 ≤ 30 天，按 avg_rating desc	发现新店
所有维度只统计 status='published' 的餐厅 + restaurantId IS NOT NULL 的帖子。

Files to Modify
路径	改动类型	说明
server/db.ts	扩展	新增 searchRestaurants + getRestaurantRankings 两个 helper
server/routers.ts	扩展	restaurants router 加 search 过程；替换 rankings router 为 getByDimension
client/src/pages/Publish.tsx	扩展	加餐厅搜索选择器（必填）；handleSubmit 加 restaurantId 校验
client/src/pages/Rankings.tsx	重写	5 Tab + 实时数据 + 卡片排名 + 空状态
不改：

drizzle/schema.ts — 0 schema 改动
server/_core/voicePostExtractor.ts — 语音功能不动
admin 相关页面
详细步骤
Step 1 — server/db.ts：新增两个 helper（45 min）
1a. searchRestaurants(q: string, limit = 10)

用于 Publish.tsx 的餐厅搜索框。模糊匹配 name 字段：

export async function searchRestaurants(q: string, limit = 10) {
  const db = getDb();
  if (!db) return [];
  return db.select({ id: restaurants.id, name: restaurants.name,
                      cuisine: restaurants.cuisine, address: restaurants.address })
    .from(restaurants)
    .where(and(eq(restaurants.status, 'published'), like(restaurants.name, `%${q}%`)))
    .limit(limit);
}
1b. getRestaurantRankings(dimension, limit = 20)

实时聚合：JOIN posts ON restaurantId，按维度排序。需要从 drizzle-orm 导入 count, avg, sql。

export type RankingDimension = 'overall' | 'hotThisWeek' | 'topRated' | 'bestValue' | 'newlyFamous';

export async function getRestaurantRankings(dimension: RankingDimension, limit = 20) {
  const db = getDb();
  if (!db) return [];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 聚合子查询：计算每家餐厅的帖子数、均分、近7天帖子数
  const rows = await db
    .select({
      id: restaurants.id,
      name: restaurants.name,
      cuisine: restaurants.cuisine,
      address: restaurants.address,
      priceLevel: restaurants.priceLevel,
      image: restaurants.image,
      createdAt: restaurants.createdAt,
      postCount: count(posts.id),
      avgRating: avg(posts.rating),
      weekPosts: sql<number>`SUM(CASE WHEN ${posts.createdAt} >= ${sevenDaysAgo} THEN 1 ELSE 0 END)`,
    })
    .from(restaurants)
    .leftJoin(posts, and(eq(posts.restaurantId, restaurants.id), isNotNull(posts.rating)))
    .where(eq(restaurants.status, 'published'))
    .groupBy(restaurants.id)
    .having(gt(count(posts.id), 0));   // 至少 1 条帖

  // 按维度排序 + 过滤（在 JS 层做，避免复杂 SQL）
  let filtered = rows;
  if (dimension === 'bestValue') {
    filtered = rows.filter(r => r.priceLevel === '便宜');
  }
  if (dimension === 'newlyFamous') {
    filtered = rows.filter(r => new Date(r.createdAt) >= thirtyDaysAgo);
  }

  const scored = filtered.map(r => {
    const avg = parseFloat(String(r.avgRating ?? '0'));
    const pc = Number(r.postCount ?? 0);
    const wp = Number(r.weekPosts ?? 0);
    let score = 0;
    if (dimension === 'overall')      score = 0.6 * avg + 0.4 * Math.log(pc + 1);
    if (dimension === 'hotThisWeek')  score = wp;
    if (dimension === 'topRated')     score = avg;
    if (dimension === 'bestValue')    score = avg;
    if (dimension === 'newlyFamous')  score = avg;
    return { ...r, avgRating: avg, postCount: pc, weekPosts: wp, score };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
注意：需要在 db.ts 顶部从 drizzle-orm 补充导入 count, avg, sql, isNotNull, gt（检查现有导入，只补缺少的）。

Step 2 — server/routers.ts：新增 restaurants.search + 替换 rankings router（30 min）
2a. restaurants router 加 search 过程

在现有 restaurants: router({...}) 内添加（不改现有过程）：

search: publicProcedure
  .input(z.object({ q: z.string().min(1), limit: z.number().default(10) }))
  .query(({ input }) => db.searchRestaurants(input.q, input.limit)),
2b. 替换 rankings router

把原来的 getByCity / getByDistrict（读预计算表，已无意义）替换为：

rankings: router({
  getByDimension: publicProcedure
    .input(z.object({
      dimension: z.enum(['overall', 'hotThisWeek', 'topRated', 'bestValue', 'newlyFamous']),
      limit: z.number().default(20),
    }))
    .query(({ input }) => db.getRestaurantRankings(input.dimension, input.limit)),
}),
Step 3 — Publish.tsx：必填餐厅选择器（1.5 h）
在「评分」字段下方插入餐厅搜索选择器。逻辑：

state：restaurantId: number | null，restaurantName: string，searchQuery: string，searchResults: []，showDropdown: boolean
useDebounce(searchQuery, 300) → 触发 trpc.restaurants.search.useQuery({ q: debouncedQ }, { enabled: !!debouncedQ })
用户从下拉列表选中一项 → 存入 restaurantId + 显示已选餐厅名（带 ✓ 和删除按钮）
handleSubmit 增加：if (!restaurantId) { toast.error("请选择关联的餐厅"); return; }
createPostMutation.mutateAsync 加上 restaurantId
已选状态 UI：
┌──────────────────────────────────────────────┐
│ 关联餐厅 *（必填）                           │
│ ✓ 太仓万达海底捞  [×]                        │
└──────────────────────────────────────────────┘
语音回填后：若 extracted.restaurantNameHint 非空，自动将 searchQuery 设为该值（触发搜索），用户从搜索结果确认选择即可（不自动强选，避免误匹配）。
Step 4 — Rankings.tsx：完整重写（1.5 h）
┌────────────────────────────────────────────────┐
│ 🏆 餐厅排行榜                                  │
│                                                │
│ [综合推荐] [本周最热] [评分最高] [性价比] [新晋]│
│                                                │
│ 🥇 太仓万达海底捞           ★4.8  📝 23 条    │
│    火锅 · 中端                                 │
│ 🥈 西浦食堂一楼              ★4.6  📝 18 条    │
│    快餐 · 便宜                                 │
│ 🥉 校门口兰州拉面            ★4.5  📝 15 条    │
│    中餐 · 便宜                                 │
│                                                │
│    [4] 太仓烧饼王           ★4.3  📝 10 条    │
└────────────────────────────────────────────────┘
实现要点：

useState<RankingDimension>('overall') 控制当前 Tab
trpc.rankings.getByDimension.useQuery({ dimension }) 获取数据
Tab 切换即刷新 query（利用 TanStack Query key 自动 refetch）
排名序号 1–3 用 🥇🥈🥉，4+ 用数字序号
点击卡片跳转餐厅详情页 /restaurants/:id
空状态：「暂无数据，快去发帖打卡吧！」+ 跳转发帖按钮
Loading 骨架屏：3 个灰色占位卡片
移除原有 mockData 引用
Step 5 — 验证（20 min）
pnpm check 无 TypeScript 错误。

端到端人工走查：

进发帖页 → 不选餐厅点发布 → 显示错误「请选择关联的餐厅」
搜索「海底捞」→ 下拉出现结果 → 选中 → 发布帖子（含评分）
进排行榜页 → 综合推荐 Tab 显示真实排名（有刚发的帖）
切换「本周最热」Tab → 数据变化，刚发的帖对应餐厅应在前列
切换「性价比」Tab → 只出现 priceLevel='便宜' 的餐厅
工时估算
Step	估时
1. db.ts 两个 helper	0.75 h
2. routers.ts 两处改动	0.5 h
3. Publish.tsx 餐厅选择器	1.5 h
4. Rankings.tsx 重写	1.5 h
5. 联调 + 走查	0.5 h
合计	~4.75 h
关键约束提醒
不运行 pnpm db:push：schema 零改动，不影响生产数据库
旧的 rankings.getByCity / getByDistrict 被替换（不保留），Rankings.tsx 中的 mock data import 删除
restaurants.averageRating 字段继续保持不更新（排行榜用实时聚合，不依赖该字段）
语音发帖的 restaurantNameHint 用于预填搜索框，不自动选中，防止误匹配