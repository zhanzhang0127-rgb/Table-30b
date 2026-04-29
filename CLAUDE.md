# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"吃了吗" / Taicang Bites — a student-exclusive, AI-enhanced dining discovery platform for the XJTLU Entrepreneur College (Taicang) community. See [docs/Product_Requirements_Document.md](docs/Product_Requirements_Document.md) for product intent and [todo.md](todo.md) for the current feature checklist. Note: the PRD describes a Next.js/FastAPI/Postgres target; the actual implementation is Vite + Express + tRPC + MySQL (Drizzle).

Package manager is **pnpm** (patched — see `pnpm.patchedDependencies` in [package.json](package.json)). Use `pnpm install`, not npm/yarn.

## Commands

```bash
pnpm dev            # tsx watch server/_core/index.ts — Express serves API and Vite middleware (single port, default 3000, auto-bumps if busy)
pnpm build          # vite build (client) + esbuild bundle server to dist/
pnpm start          # NODE_ENV=production node dist/index.js (serves built client statically)
pnpm check          # tsc --noEmit — type check
pnpm format         # prettier --write .
pnpm test           # vitest run (node env, only server/**/*.test.ts)
pnpm test server/auth.test.ts                    # run one test file
pnpm test -t "should reject unauthorized"        # run by test name
pnpm db:push        # drizzle-kit generate && drizzle-kit migrate (requires DATABASE_URL)
```

Ad-hoc migration runners also exist at [migrate.mjs](migrate.mjs) and [run-migration.mjs](run-migration.mjs) — they apply specific SQL files directly via `mysql2` with SSL. Use `pnpm db:push` for the normal flow.

## Architecture

**Single-process full-stack TypeScript app.** One Express server ([server/_core/index.ts](server/_core/index.ts)) hosts:
- `/api/oauth/callback` — Manus OAuth exchange ([server/_core/oauth.ts](server/_core/oauth.ts))
- `/api/trpc/*` — tRPC endpoint mounting the single root router
- Vite middleware in dev; static `dist/public` in prod

**tRPC is the only API surface.** All backend procedures live in [server/routers.ts](server/routers.ts), composed into one `appRouter`. The client imports `type { AppRouter }` directly from that file via [client/src/lib/trpc.ts](client/src/lib/trpc.ts) — there is no separate API schema; a server change immediately shows up as a client type. Superjson is the transformer on both ends.

Procedure tiers in [server/_core/trpc.ts](server/_core/trpc.ts):
- `publicProcedure` — no auth
- `protectedProcedure` — requires `ctx.user`
- `adminProcedure` (in trpc.ts, role === 'admin') and locally-defined `adminProcedure` / `superAdminProcedure` in [server/routers.ts:14-25](server/routers.ts#L14-L25) which allow `admin` **or** `super_admin`. Prefer the ones in routers.ts for admin-panel endpoints — they match the role model.

Auth is session-cookie based (`app_session_id`, JWT via `sdk.createSessionToken`). Context is built in [server/_core/context.ts](server/_core/context.ts); authentication failure yields `user: null` rather than throwing, so public procedures still work. The OAuth callback enforces an email-domain allowlist (`@xjtlu.edu.cn` and `@student.xjtlu.edu.cn`) plus a small admin whitelist — see [server/_core/oauth.ts:31-46](server/_core/oauth.ts#L31-L46). Existing `admin` / `super_admin` users bypass the suffix check on subsequent logins (so accounts whose email predates the rule still work).

**Dev-only login backdoor** at `/api/dev-login` (registered only when `NODE_ENV !== "production"`, see [server/_core/oauth.ts:69-105](server/_core/oauth.ts#L69-L105)) issues a session cookie for `OWNER_OPEN_ID` (or `?openId=` override) without going through Manus OAuth. Paired with a yellow banner on [Home.tsx](client/src/pages/Home.tsx) gated by `import.meta.env.DEV`. **Must be removed after Demo Day** — see cleanup checklist in [docs/session-2026-04-25.md](docs/session-2026-04-25.md).

**Database is MySQL via Drizzle ORM.** Schema lives in [drizzle/schema.ts](drizzle/schema.ts); access helpers in [server/db.ts](server/db.ts). The drizzle client is **lazy** (`getDb()`): if `DATABASE_URL` is missing or connection fails, it returns `null` and most helpers log a warning and no-op. When adding a new DB-dependent code path, handle the `null` case explicitly — do not assume a connection exists.

Users have three roles: `user`, `admin`, `super_admin`. The user matching `ENV.ownerOpenId` is elevated to `super_admin` on first insert only (never overwritten) — see [server/db.ts:56-62](server/db.ts#L56-L62).

**Frontend** is React 19 + Vite + Tailwind v4 + shadcn/Radix + wouter (routing) + TanStack Query (via `@trpc/react-query`). Routes are declared in [client/src/App.tsx](client/src/App.tsx). A global query/mutation subscriber in [client/src/main.tsx](client/src/main.tsx) intercepts `UNAUTHED_ERR_MSG` (from [shared/const.ts](shared/const.ts)) and redirects to the Manus OAuth portal — so throwing `TRPCError({ code: 'UNAUTHORIZED', message: UNAUTHED_ERR_MSG })` from the server triggers a full login flow on the client.

**Path aliases** (configured in [vite.config.ts](vite.config.ts), [tsconfig.json](tsconfig.json), [vitest.config.ts](vitest.config.ts)):
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*` (constants and types used by both client and server — edit here to keep them in sync)
- `@assets/*` → `attached_assets/*`

**Image uploads** go through a Manus-provided storage proxy ([server/storage.ts](server/storage.ts)) using `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY`. The `posts.create` procedure accepts data-URL base64 images, decodes them, enforces a 10MB/image cap, then calls `storagePut`. Body parser limit is 50MB ([server/_core/index.ts:34](server/_core/index.ts#L34)) to accommodate multi-image posts.

**AI** calls go to Zhipu GLM-4 (`glm-4-flash`) via [server/_core/glm4.ts](server/_core/glm4.ts), keyed by `GLM4_API_KEY`. Only the server holds the key. `invokeGLM4` accepts an optional `responseFormat: { type: 'json_object' }` option for structured JSON extraction.

**Voice-to-post pipeline** (added 2026-04-26): [server/_core/voiceTranscription.ts](server/_core/voiceTranscription.ts) wraps Whisper-1 via Forge API. [server/_core/voicePostExtractor.ts](server/_core/voicePostExtractor.ts) calls GLM-4 in JSON mode to extract `{ title, content, rating, restaurantNameHint, recommendedDish }` from transcribed speech. The `voice` tRPC router exposes `transcribeDirect` (Buffer → Whisper directly, no storage round-trip) and `extractPost`. Frontend entry point: [client/src/pages/Publish.tsx](client/src/pages/Publish.tsx) voice card above the title field.

## Environment

Required env vars (loaded via `dotenv/config` at server boot; see [server/_core/env.ts](server/_core/env.ts)):
- `DATABASE_URL` — MySQL URL (SSL required by the remote; the connection-string drizzle client uses it directly)
- `JWT_SECRET` — signs session cookies
- `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL` — Manus OAuth
- `OWNER_OPEN_ID` — openId of the account that should become `super_admin` on first login
- `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` — storage proxy
- `GLM4_API_KEY` — AI
- `AMAP_API_KEY` — map features

## Testing

Tests live beside the code in `server/*.test.ts` and run in Node environment. They exercise real router procedures; several require `DATABASE_URL` to be set. Client code is not covered by the current test setup.

## Conventions

- Server code uses **camelCase column names** in the MySQL schema (matches TypeScript types exactly — no snake_case/camelCase translation layer). Preserve this when adding columns.
- Error messages for user-facing auth/authorization failures are in Chinese by design (e.g. `需要管理员权限`). Match existing tone when adding new ones.
- When adding a new tRPC procedure that mutates data, prefer creating a helper in [server/db.ts](server/db.ts) and calling it from the router — keep SQL out of `routers.ts`.
- Don't edit files under `drizzle/` migrations by hand; re-run `pnpm db:push` to regenerate.

## 产品定位与背景

### 一句话定位
"吃了吗" (Chileoma) — 由西浦学生共建、为西浦学生服务、只讲真话的最纯净校园美食分享生态。功能形态类似美团，但**无商家入驻、无付费推广、无算法操控**。

### 目标用户
仅限 XJTLU 太仓校区师生。邮箱白名单：`@xjtlu.edu.cn`（教职工）/ `@student.xjtlu.edu.cn`（学生）。两者均已在 [oauth.ts:35](server/_core/oauth.ts#L35) 落地，已存在的 admin/super_admin 账号绕过校验。

### 核心痛点（用于演讲与 PR 文案的事实底座）
1. 太仓校区周边餐饮极度匮乏，食堂学生已基本吃遍
2. 学生高频点外卖，但美团/抖音存在刷单、广告、虚假推荐，真实评价难沉淀
3. 太仓万达广场（约 4 公里外）和散落各处的宝藏小店曝光度低，缺乏学生视角发现机制

### 差异化价值（每次产品决策的判断依据）
- **封闭性**：高信任度社区，内容全部来自真实校内成员（邮箱白名单是这一点的技术抓手 — 不要为了"开放注册"轻易破坏）
- **去商业化**：无商家入驻、无付费推广、无算法操控（任何"推广位""置顶""赞助"类设计都与产品定位冲突）
- **防作弊**：天然规避刷评、水军、虚假种草

### 当前完成度（与 PRD 对齐）
- ✅ 内容发布、餐厅列表/详情、用户评分评论、登录会话、基础数据库结构均已完成（见 [todo.md](todo.md)）
- ⚠️ **UI**：早期模仿美团配色，缺乏品牌独特性，需在 Demo 前重构以体现去商业化定位
- ⚠️ **社区模块**：模块间逻辑割裂（如：发帖 → 餐厅页 → 排行榜 → AI 推荐之间未形成闭环）
- ❌ **AI 助手**：未完善（位置感知已通，但对话连贯性、上下文注入、推荐解释链路待完善）
- ❌ **排行榜**：未完善

### Demo Day 上下文（驱动当前所有优先级）
- 时间：2026 年 5 月 6/7/8 日（周三/四/五），每组 10 分钟（6 分钟演讲 + 4 分钟 Q&A）
- 评分占 40%，权重分布：演讲质量 10% / 原型演示 15% / **用户验证证据 10% / 技术 Q&A 5%**
- **关键洞察**：用户验证证据（10%）= 两倍技术 Q&A（5%）。一个简单产品 + 强迭代证据 > 复杂原型 + 无用户反馈
- 评分偏好"过程胜于技术"：诚实记录"做了 Y 用户没用所以砍掉"比展示完整功能得分更高
- 完整评分标准见 [docs/requirement.md](docs/requirement.md) — **所有开发优先级以该文件为最终依据**
- 任务清单见 [todo.md](todo.md) "Demo Day 冲刺计划" 章节

### 工作时的判断准则
1. **演示主路径优先**：核心 Demo 流程（登录 → 浏览/搜索餐厅 → 看 UGC 评价 → AI 推荐 → 发帖）任一环出错即失分，先稳定这条线再做其他
2. **用户测试 > 新功能**：当面对"做新功能"vs"做用户测试 + 迭代证据"的取舍，**永远选后者**
3. **去商业化是红线**：拒绝任何"广告位""推广""置顶""商家入驻"提案，即使技术上很容易实现
4. **诚实砍功能**：如果某模块（如复杂的积分体系）在演讲日前不可能完整，应建议明确放进"What comes next"而不是半成品上线

### 已知阻塞（截至 2026-04-25）
所有诊断与时间线见 [docs/session-2026-04-25.md](docs/session-2026-04-25.md)。

- **Manus OAuth 验证码邮件投递失效** — 新用户无法注册。代码层无法修复（验证码由 Manus 服务端发送），需联系 Manus 客服。用户测试期间只能用已注册账号
- **Manus OAuth 回调白名单未含 `http://localhost:3000/...`** — 本地 OAuth 跳转触发 CloudFront 403。已通过 `/api/dev-login` 后门绕过，无需阻塞开发
- **DB 内只有 1 用户 + 1 测试帖** — 组员之前的 Manus 部署疑似在另一个 DB 实例。本地 Feed/餐厅页/排行榜全是空状态，需要 seed 脚本。`posts.id = 420003` 是 TiDB 分布式自增 ID 的正常表现，**不是丢数据**

### 演讲后必删代码
Demo Day 结束后立即删除以下兜底实现：

- [server/_core/oauth.ts:69-105](server/_core/oauth.ts#L69-L105) 整个 dev-login 块
- [client/src/pages/Home.tsx](client/src/pages/Home.tsx) 中的 `{import.meta.env.DEV && (...)}` 黄色横幅

注：生产构建时这两段都不会暴露（NODE_ENV 守卫 + Vite tree-shake），但仍应清理以保持代码卫生。

### .env 注意事项
- 必须用 **LF 换行符**（不是 CR/CRLF）。Node 的 dotenv 不识别 `\r`-only，会把整个文件当成 1 行 → 只有第一个变量被解析、其余全失效
- `VITE_APP_ID` 不要拼成 `ITE_APP_ID`（少 V 的话前端登录 URL 会缺 appId 参数）
- `DATABASE_URL` 中的 `?ssl={"rejectUnauthorized":true}` JSON 片段无需引号转义，dotenv 可正确处理

### 数据库共用注意事项

本地 `.env` 的 `DATABASE_URL` 与 Manus 部署（`chileoma-xzewdxgs.manus.space`）**指向同一个远程 TiDB 实例**。本地发的帖、改的餐厅数据会立刻反映到生产网页。以下操作会破坏生产数据，谨慎执行：

- `pnpm db:push` / `migrate.mjs` / `run-migration.mjs` → 直接 ALTER 共享 schema
- 通过本地 admin UI 增删餐厅 / 变更用户角色

代码改动（tRPC 过程、前端组件）不会影响生产，只有数据写入才会。

---

## 关键决策记录

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-04-25 | 邮箱白名单扩展为 `@xjtlu.edu.cn` + `@student.xjtlu.edu.cn`；已有 admin/super_admin 账号绕过校验 | 教职工账号合法但后缀不同；已有账号需保持可登录 |
| 2026-04-25 | 新增 `/api/dev-login` 后门（仅 dev 模式）绕过 Manus OAuth | Manus OAuth 回调白名单不含 localhost，本地无法走正常登录流程 |
| 2026-04-26 | 语音发帖 MVP 仅做 STT + LLM 抽取 + 回填，不做 Amap POI 锚定与 schema 迁移 | Demo Day 仅剩 10 天，完整方案需 4–5 天，风险高于收益 |
| 2026-04-26 | GLM-4 扩展 `response_format` 支持而非引入 Gemini 第二 provider | 保持 AI 技术栈一致，团队已有 GLM-4 调试经验，中文 NER 效果更稳 |
| 2026-04-26 | `transcribeDirect`：音频 Buffer 直发 Whisper，跳过 Forge Storage 存取 | 原管道含 4 次串行网络跳转（其中 2 次存储来回多余），优化后节省约 3–5 秒 |
| 2026-04-26 | Base64 解析改用 `indexOf(';base64,')` 替代 regex | `MediaRecorder` mimeType 含 codec 参数（如 `audio/webm;codecs=opus`），regex `[^;]+` 匹配失败 |
| 2026-04-26 | 本地与生产共用数据库，暂不隔离（方案 A） | Demo 倒计时紧，新建 TiDB 实例 + seed 数据成本高；约定 Demo 前手动清理测试帖 |
| 2026-04-26 | 去餐厅化（用户侧）：取消发帖强制关联餐厅，移除用户主路径中的餐厅/独立排行榜入口 | 团队精力无法维护大规模商家库；产品核心是「真实评价社区」而非商家信息平台 |
| 2026-04-26 | 排序能力并入社区：社区顶部改为「最新 / 最热」，最热按 likes + comments 综合排序（同分按发布时间） | 用最小交互成本保留内容发现能力，替代独立排行榜页，降低信息架构复杂度 |
| 2026-04-26 | 手机端底部导航改为三入口（社区/AI助手/个人），发布按钮上移到社区页顶部 | 去掉中间悬浮发布后保持导航对称与一致性，同时保留高频发帖可达性 |
| 2026-04-26 | 共享数据库场景下不执行 `db:push`，改为运行时 schema 兼容（读写回退旧列） | 避免 ALTER 线上共享表结构导致生产风险，同时保证本地开发可继续 |
| 2026-04-26 | 旧库模式下将 postType/tasteRating/valueRating/location 以内嵌元数据写入 content 并在读取时回填；历史旧帖默认堂食 | 在不改表结构前提下保留新发帖分类语义，消除详情页“未分类”体验问题 |
| 2026-04-26 | 分析脚本改为前端运行时按 env 条件注入，并在服务端增加 malformed URI 容错 | 解决 `%VITE_ANALYTICS_ENDPOINT%` 占位符未替换导致的噪声报错与终端刷屏 |
