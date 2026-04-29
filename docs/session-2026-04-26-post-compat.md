# 开发会话日志 — 2026-04-26（发帖功能与旧库兼容）

本次会话目标：在不执行数据库迁移（不改线上共享 TiDB schema）的前提下，完成发帖功能升级后的兼容落地，并修复由环境变量占位符引发的本地噪声错误。

---

## 1. 对话背景与约束

用户明确提出两项约束：

1. 开发前必须完整阅读 [init.md](../.claude/commands/init.md)、[CLAUDE.md](../CLAUDE.md)、[plan_for_post.md](plan_for_post.md)
2. 不允许执行会影响线上共享库的 schema 变更（即不执行 `pnpm db:push`）

因此本次实现策略从“直接迁移”调整为“运行时兼容旧表结构”。

---

## 2. 关键问题与根因

### 2.1 问题 A：首页刷屏报错 `/%VITE_ANALYTICS_ENDPOINT%/umami`

现象：
- Vite 报 `%VITE_ANALYTICS_ENDPOINT% is not defined`
- Express 报 `Malformed URI sequence`

根因：
- 分析脚本使用了 HTML 占位符 `%VITE_ANALYTICS_ENDPOINT%` 与 `%VITE_ANALYTICS_WEBSITE_ID%`
- 当环境变量未定义时，占位符原样进入请求路径并触发路由解码异常

### 2.2 问题 B：旧帖“看不到”

现象：
- 社区接口 `posts.getFeed` 返回 500
- SQL 查询包含 `postType/tasteRating/valueRating/location`

根因：
- 代码已升级为新 posts 字段
- 当前数据库仍是旧表结构（缺 4 个新列）

### 2.3 问题 C：可以发帖后，详情页出现“未分类”

现象：
- 用户发布“堂食”后，详情标题下方显示“未分类”

根因：
- 旧库无 `postType` 列
- 兼容返回中 `postType` 初始为 `null`，前端显示为“未分类”

---

## 3. 本次改动

### 3.1 分析脚本加载改造

- 修改 [client/index.html](../client/index.html)
  - 移除占位符脚本直写方式
- 修改 [client/src/main.tsx](../client/src/main.tsx)
  - 改为运行时条件注入：仅当 `VITE_ANALYTICS_ENDPOINT` 与 `VITE_ANALYTICS_WEBSITE_ID` 同时存在时才注入脚本

### 3.2 服务端 URI 容错

- 修改 [server/_core/index.ts](../server/_core/index.ts)
  - 增加针对 `Failed to decode param` / `URIError` 的错误处理中间件
  - 将异常请求返回 400，避免终端持续刷栈

### 3.3 posts 旧库兼容（核心）

- 修改 [server/db.ts](../server/db.ts)
  - 新增 `hasExtendedPostColumns()`：运行时探测 posts 是否包含扩展列
  - 扩展列不存在时：
    - `getPostsForFeed/getPostsByUserId/getPostById/getMyLikedPostsWithDetails` 回退到旧列查询
    - `createPost` 回退为仅写入旧列（`userId/title/content/images/restaurantId/rating`）

### 3.4 “未分类”修复（兼容增强）

- 修改 [server/db.ts](../server/db.ts)
  - 在旧库模式下，将 `postType/tasteRating/valueRating/location` 以隐藏注释元数据写入 `content`
  - 读取帖子时解析元数据并回填字段
  - 对历史旧帖（无元数据）默认 `postType = 'dine-in'`

这样既不改库结构，也能让新发布帖子保持分类语义。

---

## 4. 验证结果

### 4.1 类型检查

- `pnpm check` 通过

### 4.2 读接口验证

- `posts.getFeed` 从 500 恢复为正常返回
- 可看到历史帖子

### 4.3 写接口验证

- 通过真实 HTTP 链路（`/api/dev-login` 获取 cookie 后调用 `posts.create`）发布成功
- 带图片发布成功

### 4.4 分类验证

- 新发帖后读取 feed，返回 `postType: "dine-in"`
- 新帖不再出现“未分类”

---

## 5. 影响与边界

### 已解决

1. 不迁移数据库前提下，社区读取与发帖均可用
2. 新帖分类在旧库模式下可用
3. 分析占位符导致的本地噪声显著降低

### 仍需注意

1. 旧帖如果无元数据，会按“堂食”默认展示（这是兼容策略，不是历史真实语义）
2. 若未来允许迁移并补齐新列，可去掉 content 元数据兼容分支

---

## 6. 后续建议

1. 在发布页加入“兼容模式提示文案”（仅旧库模式显示）
2. 在 Demo 后窗口统一执行 schema 升级，再清理旧库兼容代码
3. 补一组针对旧库兼容读写的自动化测试，避免未来回归
