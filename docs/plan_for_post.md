# Plan: 发帖功能优化（外卖/堂食 + 二维评分 + 位置标签）

## Context

现状的发帖流程是「一刀切」的单一表单：[Publish.tsx](client/src/pages/Publish.tsx) 把所有用户（点外卖的、堂食的、纯种草的）塞进同一个 UI，评分也是单一 1–5 星，缺乏区分度。

目标：
1. **入口分流**：进入发帖页第一时间让用户选「外卖」或「堂食」，对应不同表单字段
2. **评分维度化**：单一评分 → 「口味 + 性价比」二维评分，两个都必填
3. **堂食专属位置标签**（可选）：用户可点「获取位置」按钮，调用高德 reverseGeocode 自动填入当前位置文本
4. **复用现有高德能力**：[AiChat.tsx:87-123](client/src/pages/AiChat.tsx#L87-L123) 已有完整的 geolocation + reverseGeocode 实现，本次抽成 `useLocationPicker` hook 让两处共用

约束：
- 用户已确认运行 `pnpm db:push` 做 schema 迁移；新增列设计为前向兼容（旧数据 postType 默认 `dine-in`，旧 `rating` 列保留不删，旧帖正常显示）
- 不破坏现有语音整理功能（已上线，[voicePostExtractor](server/_core/voicePostExtractor.ts) 输出的 `rating` 字段映射到「口味」评分作为默认值，用户可调整）
- 去商业化红线不变

---

## Files to Modify

| 路径 | 改动 | 说明 |
| --- | --- | --- |
| [drizzle/schema.ts](drizzle/schema.ts) | 扩展 | posts 表新增 4 列 |
| [server/db.ts](server/db.ts) | 扩展 | `createPost` 接受新字段；查询返回新字段（自动 by drizzle）|
| [server/routers.ts](server/routers.ts) | 扩展 | `posts.create` 输入 schema 加 4 个字段 |
| [client/src/hooks/useLocationPicker.ts](client/src/hooks/useLocationPicker.ts) | 新增 | 抽出 geolocation + reverseGeocode 逻辑 |
| [client/src/pages/Publish.tsx](client/src/pages/Publish.tsx) | 大改 | 入口类型选择 + 条件渲染 + 二维评分 + 位置字段 |
| [client/src/pages/AiChat.tsx](client/src/pages/AiChat.tsx) | 小改 | 用新 hook 替换内联逻辑（保持行为一致）|
| [client/src/pages/PostDetail.tsx](client/src/pages/PostDetail.tsx) | 小改 | 展示二维评分 + postType badge + location（如有）|

**不改**：[Feed.tsx](client/src/pages/Feed.tsx) 暂不展示二维评分（保持卡片简洁，单值取 `(taste+value)/2` 显示，旧帖 fallback 到 `rating`）

---

## Schema 设计

### 改动

[drizzle/schema.ts](drizzle/schema.ts) 的 `posts` 表新增 4 列（**保留** 现有 `rating` 列做向后兼容，**不删**）：

```ts
postType: varchar('postType', { length: 20 }).notNull().default('dine-in'),
tasteRating: int('tasteRating'),    // nullable, 1–5
valueRating: int('valueRating'),    // nullable, 1–5
location: varchar('location', { length: 255 }),  // nullable, 仅堂食使用
```

旧数据兼容：
- 旧帖 `postType` 默认 `'dine-in'`（合理推断：早期用户更可能在堂食场景下发帖）
- 旧帖 `tasteRating` / `valueRating` 为 NULL，显示时 fallback 到 `rating`
- 旧帖 `location` 为 NULL，UI 不显示该行

---

## 详细步骤

### Step 1 — Schema 迁移（15 min）

修改 [drizzle/schema.ts](drizzle/schema.ts) 的 `posts` 表，加入上面 4 列。

执行：
```bash
pnpm db:push
```

⚠️ 这会同步修改生产数据库表结构。新增列均为 nullable 或带 default，**不影响现有部署版的运行**（旧后端代码读到这些新列会忽略，新建帖子时不会传新字段，会用 default）。

### Step 2 — 扩展 `db.createPost` + tRPC 输入（30 min）

[server/db.ts](server/db.ts) 的 `createPost` 函数 signature 加 4 个可选参数 `postType`、`tasteRating`、`valueRating`、`location`，写入对应列。

[server/routers.ts:42-89](server/routers.ts#L42-L89) `posts.create` 的 zod schema 调整：

```ts
z.object({
  title: z.string().min(1),
  content: z.string(),
  images: z.array(z.string()).optional(),
  restaurantId: z.number().optional(),
  postType: z.enum(['delivery', 'dine-in']),       // 必填
  tasteRating: z.number().int().min(1).max(5),     // 必填
  valueRating: z.number().int().min(1).max(5),     // 必填
  location: z.string().max(255).optional(),
  // 旧 rating 字段保留 optional，不传也行
  rating: z.number().min(1).max(5).optional(),
})
```

后端在写入时同步把 `(tasteRating + valueRating) / 2` 也写入 `rating` 列（向后兼容：旧前端如果还在跑、读 `rating` 列依然能正确显示均分）。

### Step 3 — `useLocationPicker` hook（30 min）

新建 [client/src/hooks/useLocationPicker.ts](client/src/hooks/useLocationPicker.ts)：

```ts
export function useLocationPicker() {
  const [location, setLocation] = useState<{ address: string; latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const reverseGeocode = trpc.restaurants.reverseGeocode.useMutation();

  const fetchLocation = async (): Promise<void> => {
    if (!navigator.geolocation) { toast.error('浏览器不支持定位'); return; }
    setLoading(true);
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const result = await reverseGeocode.mutateAsync({ latitude, longitude });
            setLocation({ address: result.address, latitude, longitude });
            toast.success('已获取位置：' + result.address);
          } catch {
            const { latitude, longitude } = pos.coords;
            setLocation({ address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, latitude, longitude });
            toast.warning('位置已获取，但解析地址失败');
          } finally { setLoading(false); resolve(); }
        },
        (err) => {
          setLoading(false);
          toast.error(err.code === 1 ? '请允许位置权限' : '获取位置失败');
          resolve();
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  };

  const clearLocation = () => setLocation(null);
  return { location, loading, fetchLocation, clearLocation };
}
```

[AiChat.tsx](client/src/pages/AiChat.tsx) 的内联实现替换为 `const { location, loading, fetchLocation, clearLocation } = useLocationPicker();`，保持原有 UI 行为不变。

### Step 4 — Publish.tsx 重构（2.5 h）

**整体结构**：状态机 + 条件渲染。

```tsx
const [postType, setPostType] = useState<'delivery' | 'dine-in' | null>(null);
const [tasteRating, setTasteRating] = useState<number | null>(null);
const [valueRating, setValueRating] = useState<number | null>(null);
const { location, loading: locLoading, fetchLocation, clearLocation } = useLocationPicker();
```

**View A：未选类型时（`postType === null`）**

```
┌───────────────────────────────────────┐
│ 你想分享什么？                        │
│                                       │
│  ┌───────────┐    ┌───────────┐       │
│  │  🛵 外卖  │    │ 🍽 堂食   │       │
│  │  点外卖   │    │ 到店吃饭  │       │
│  └───────────┘    └───────────┘       │
└───────────────────────────────────────┘
```

两个大卡片，点击设置 `postType`。

**View B：选定类型后**

顶部显示已选类型 + 切换按钮（`onClick={() => setPostType(null)}` 回到 View A）。表单字段：

| 字段 | 外卖 | 堂食 |
| --- | --- | --- |
| 语音整理（实验功能） | ✅ | ✅ |
| 标题 | ✅ | ✅ |
| 内容 | ✅ | ✅ |
| 口味评分（必填） | ✅ | ✅ |
| 性价比评分（必填） | ✅ | ✅ |
| 位置标签（可选） | ❌ | ✅ |
| 图片 | ✅ | ✅ |

**二维评分 UI**：

```
口味 *  ★★★★☆  (4)
性价比 *  ★★★★★  (5)
```

两行 1–5 星选择器，标签清晰区分。提交按钮 disabled 直到两项都选。

**位置标签 UI**（仅 dine-in）：

```
┌───────────────────────────────────────────┐
│ 📍 位置标签（可选）                       │
│ ┌─────────────────────────┐  ┌─────────┐  │
│ │ 太仓市西交利物浦大学... │  │ 获取位置│  │
│ └─────────────────────────┘  └─────────┘  │
│                                  [清空]   │
└───────────────────────────────────────────┘
```

- 文本框可手动编辑（控件 value 绑定 `location?.address ?? customText`）
- 「获取位置」调 `fetchLocation()`
- 「清空」调 `clearLocation()`

**handleSubmit 校验**：

```ts
if (!title.trim() || !content.trim()) { toast.error('请填写标题和内容'); return; }
if (tasteRating === null || valueRating === null) { toast.error('请完成口味和性价比评分'); return; }
await createPostMutation.mutateAsync({
  title, content, images,
  postType: postType!,
  tasteRating, valueRating,
  location: postType === 'dine-in' ? (location?.address ?? undefined) : undefined,
});
```

**语音功能调整**：保留现有语音录入逻辑（标题/正文/餐厅提示/推荐菜回填不变），但 **不再** 用语音抽出的评分自动填入二维评分。原因：评分动作非常轻（点几颗星），交给用户自己评更准确，也避免 AI 误读「打 4 分」这类口语导致评分错误。具体改法：在 `processVoiceBlob` 成功分支里，**移除** `if (extracted.rating !== null) setRating(extracted.rating);` 一行；`extracted.rating` 字段直接忽略。voicePostExtractor 后端不动（保留 rating 字段输出，前端不使用）。

### Step 5 — PostDetail.tsx 展示更新（30 min）

[PostDetail.tsx](client/src/pages/PostDetail.tsx) 顶部显示：

```
[🛵 外卖] 标题
口味 ★★★★☆  性价比 ★★★★★
📍 太仓市西交利物浦大学 (仅堂食有 location 时)
```

旧帖（`tasteRating === null`）fallback 显示原 `rating` 单值 + 「[未分类]」badge。

### Step 6 — 验证（30 min）

`pnpm check` 通过；不写新单测（schema + UI 改动为主，现有 60+ 个测试不受影响）。

端到端走查：
1. 登录 → 进 `/publish` → 看到类型选择卡片
2. 选「外卖」→ 表单出现，含口味+性价比但无位置字段
3. 不评分点提交 → 报错「请完成口味和性价比评分」
4. 完整填写 → 提交 → 跳 Feed 看到新帖
5. 回 `/publish` → 选「堂食」→ 表单出现，含位置字段
6. 点「获取位置」→ 浏览器请求权限 → 同意 → 文本框自动填入「太仓市...」
7. 提交 → 进 PostDetail 验证显示「🍽 堂食 / 口味/性价比 / 📍 位置」
8. 数据库 `posts` 表新增 row 含正确的 postType / tasteRating / valueRating / location

---

## 工时估算

| Step | 估时 |
| --- | --- |
| 1. Schema 迁移 | 0.25 h |
| 2. db.ts + routers.ts | 0.5 h |
| 3. useLocationPicker hook + AiChat 替换 | 0.5 h |
| 4. Publish.tsx 重构 | 2.5 h |
| 5. PostDetail.tsx 展示 | 0.5 h |
| 6. 联调走查 | 0.5 h |
| **合计** | **~4.75 h** |

---

## 数据库共用风险提醒

`pnpm db:push` 会**直接 ALTER 生产表**（本地与生产共用同一个 TiDB 实例，见 [CLAUDE.md](CLAUDE.md) 数据库共用注意事项）。本次新增的 4 列均为 nullable 或有 default，**不会破坏部署版的旧后端代码**（旧代码不知道新列存在，写入时不传，读出时忽略）。但仍需注意：

- ✅ 旧后端代码（manus.space）读 posts → 不会因新列报错
- ✅ 旧后端代码写 posts → 新列取 default（postType=`'dine-in'`，其余 NULL）
- ✅ 新本地代码读旧帖 → tasteRating/valueRating 为 NULL，UI 走 fallback
- ⚠️ 不可逆：一旦 push 完，回滚需要手动 DROP COLUMN

建议执行 `pnpm db:push` 前先 `git status` 确认 [drizzle/schema.ts](drizzle/schema.ts) 的 diff 仅包含本次新增 4 列。
