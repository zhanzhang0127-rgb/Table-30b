# Chileoma

Chileoma is a campus food community app with posts, restaurant submissions, nearby rankings, AI chat, profile pages, and an admin panel.

## Tech Stack

- React + Vite + TypeScript
- Express + tRPC
- MySQL + Drizzle ORM
- Tailwind CSS style utilities and Radix UI components

## Local Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create an environment file:

   ```bash
   cp .env.example .env
   ```

3. Fill in `DATABASE_URL` and any optional API keys you want to test.

4. Run database migrations:

   ```bash
   pnpm db:push
   ```

5. Start the app:

   ```bash
   pnpm dev
   ```

6. Open:

   ```text
   http://localhost:3000
   ```

## Local Preview Mode

When the app is opened from `localhost`, `127.0.0.1`, `::1`, or a private LAN IP such as `192.168.x.x`, the backend creates a local preview user automatically. This makes it possible to test the app without Manus OAuth during local development.

Do not use local preview mode as production authentication.

## What Was Excluded From The GitHub Copy

The prepared `chileoma-github` folder intentionally excludes:

- `.env` and other local environment files
- `output/` Manus exports, SQL dumps, screenshots, and temporary files
- `client/public/local-assets/` imported user images
- `client/public/__manus__/` generated Manus runtime files
- browser review cache folders
- build outputs and dependency folders

These files are local development artifacts or sensitive data and should not be uploaded to GitHub.
## Dev Log - Zane
- 2026-04-11: 初始化项目，建立网站基础结构（手写）
- 2026-04-11: 实现人员登录功能
- 2026-04-11: 实现图片及文字上传功能
- 2026-04-21: 社区界面优化，修复点赞功能，支持图片放大查看，优化导航结构及发帖提示
- 2026-04-27: 完成餐厅页面部署，接入高德地图API实现自动定位；创建管理员后台，支持实时审核用户发帖及餐厅提交；接入智谱大模型实现AI聊天，结合高德API推荐附近餐厅
- 2026-05-02: Manus功能完整迁移至本地部署，实现中英文切换，接入高德API，优化导航栏及餐厅发布界面，整合餐厅与社区页面