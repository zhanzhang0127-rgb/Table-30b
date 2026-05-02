# XJTLU


XJTLU Entrepreneur College (Taicang)


<table><tr><td>Module Code and Title</td><td>ENT208TC Industry Readiness</td></tr><tr><td>School Title</td><td>XJTLU Entrepreneur College (Taicang)</td></tr><tr><td>Assignment Title</td><td>Technical Documentation</td></tr><tr><td>Submission Deadline</td><td>Friday 15 May, 2026 before 23:59 (Beijing Time, GMT+8)</td></tr><tr><td>Session and Group</td><td>Session 4 — Group 30</td></tr><tr><td>Student IDs</td><td>2364234, 2363896, 2363370, 2364227, 2363771, 2255293</td></tr><tr><td>Final Word Count</td><td></td></tr><tr><td>If you agree to let the university use your work anonymously for teaching and learning purposes, please type "yes" here.</td><td>YES</td></tr></table>

I certify that I have read and understood the University's Policy for dealing with Plagiarism, Collusion, and the Fabrication of Data (available on Learning Mall Online). With reference to this policy, I certify that: 

My work does not contain any instances of plagiarism and/or collusion. My work does not contain any fabricated data. 

By uploading my assignment onto Learning Mall Online, I formally declare that all of the above information is true to the best of my knowledge and belief. 

<table><tr><td colspan="8">Scoring — For Tutor Use</td></tr><tr><td>Student ID</td><td colspan="7">D</td></tr><tr><td>Stage of Marking</td><td>Marker Code</td><td colspan="5">Learning Outcomes Achieved (F/P/M/D)</td><td>Final Score</td></tr><tr><td></td><td></td><td>A</td><td>B</td><td>C</td><td>D</td><td>E</td><td></td></tr><tr><td>1st Marker — red pen</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>Moderation — green pen</td><td>IM Initials</td><td colspan="5">The original mark has been accepted by the moderator: Y / N</td><td>Y / N</td></tr><tr><td>2nd Marker if needed</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></table>

Xi'an Jiaotong-Liverpool University 

西交利物浦大学

Comprehensive technical reference enabling another developer to understand, maintain, and deploy your product. Includes a strategic IP analysis section. Target length: 6–9 pages (excluding references and cover page). File name: Session[X]Group[Y]_TechnicalDoc.docx 

<table><tr><td>✓ Submission checklist — confirm before uploading</td></tr><tr><td>□ 6–9 pages (excluding references and cover page)</td></tr><tr><td>□ Font: Calibri or Times New Roman, 12pt, 1.5 line spacing, justified</td></tr><tr><td>□ File: Session[X]Group[Y]_TechnicalDoc.docx (.docx or .pdf)</td></tr><tr><td>□ Cover page: group number + all 7 student IDs</td></tr><tr><td>□ Section 1 — system architecture diagram included</td></tr><tr><td>□ Section 2 — technology choices justified with alternatives</td></tr><tr><td>□ Section 3 — deployment guide: someone else can run your project</td></tr><tr><td>□ Section 4 — IP Strategy: novelty, prior art, patent decision</td></tr><tr><td>□ Section 5 — limitations and future work</td></tr><tr><td>□ All references in APA 7th edition (not counted in page limit)</td></tr></table>

---

# Section 1 — System Architecture

## Overview

Chileoma ("吃了吗") is a full-stack, single-process TypeScript web application deployed on the Manus cloud platform. The entire product — API server, database access layer, and frontend SPA — runs inside one Node.js process. This deliberately simple architecture minimises operational complexity and infrastructure cost, which was appropriate given the team's size (six students) and the ten-day sprint to Demo Day.

The system can be divided into six distinct layers: the React frontend SPA, the Express HTTP server, the tRPC router layer, the database access layer, and two categories of external services (AI inference and file storage).

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                   │
│  wouter routing │ TanStack Query │ tRPC React client     │
│  Pages: Home / Feed / Publish / AI Chat / Profile / Admin│
└──────────────────────────┬──────────────────────────────┘
                           │  HTTP (same origin)
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Express HTTP Server (Node.js)               │
│                                                         │
│  /api/oauth/callback ──► Manus OAuth exchange           │
│  /api/dev-login      ──► Dev backdoor (dev mode only)   │
│  /api/trpc/*         ──► tRPC middleware                 │
│  /*                  ──► Vite dev middleware (dev)       │
│                          Static dist/public   (prod)     │
└──────────┬──────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│               tRPC Router (routers.ts)                   │
│                                                          │
│  auth │ posts │ restaurants │ profile │ favorites        │
│  comments │ likes │ rankings │ admin │ aiRecommendations │
│  voice                                                   │
│                                                          │
│  Procedure tiers:                                        │
│    publicProcedure → no auth required                    │
│    protectedProcedure → requires valid session cookie    │
│    adminProcedure → requires admin or super_admin role   │
│    superAdminProcedure → requires super_admin only       │
└──────────┬─────────────────────────────────────┬─────────┘
           │                                     │
           ▼                                     ▼
┌──────────────────────┐           ┌─────────────────────────────┐
│  Database Layer      │           │  External Services           │
│  (server/db.ts)      │           │                             │
│                      │           │  Zhipu GLM-4 Flash          │
│  Drizzle ORM         │           │  (AI chat + JSON extraction)│
│  ↕                   │           │                             │
│  TiDB (MySQL-compat) │           │  OpenAI Whisper-1           │
│  Tables:             │           │  (voice transcription)      │
│  - users             │           │                             │
│  - posts             │           │  Manus Forge Storage        │
│  - restaurants       │           │  (image & audio upload)     │
│  - comments          │           │                             │
│  - postLikes         │           │  AMap REST API              │
│  - commentLikes      │           │  (reverse geocoding)        │
│  - favorites         │           │                             │
│  - userProfiles      │           │  Manus OAuth Server         │
│  - aiRecommendations │           │  (authentication)           │
│  - rankings          │           └─────────────────────────────┘
└──────────────────────┘
```

## Component Overview

**React SPA (Frontend).** The client is a single-page application built with React 19 and Vite. Routing is handled by wouter; server state is managed entirely through TanStack Query via the `@trpc/react-query` adapter. There is no separate client-side state management library — tRPC queries and mutations serve as the single source of truth. The UI uses shadcn/ui components (built on Radix UI primitives) styled with Tailwind CSS v4. Key pages include Feed (community post list with latest/hottest sorting), Publish (text + image + voice-to-post), AI Chat (personalised restaurant recommendations), and a role-gated Admin panel.

**Express HTTP Server.** One Express instance handles all inbound traffic on a single port (default 3000, auto-bumped if busy). In development, Vite middleware is mounted at the catch-all route, enabling Hot Module Replacement without a separate dev server. In production, pre-built static assets in `dist/public` are served. The body-parser limit is 50 MB to accommodate multi-image post submissions carrying base64-encoded data.

**tRPC Router.** Every server-to-client API call goes through tRPC. The `appRouter` in `server/routers.ts` composes ten sub-routers. The client imports `type { AppRouter }` directly, so TypeScript propagates server type changes to the client instantly without a code-generation step. Superjson is used as the transformer on both ends to support serialising dates and other non-JSON-native types. Four procedure tiers enforce role-based access control: public, protected (authenticated), admin, and super_admin.

**Database Access Layer (`server/db.ts`).** All SQL logic lives in helper functions exported from `db.ts`; the routers call these helpers rather than constructing queries inline. The Drizzle ORM client is lazy: it returns `null` if `DATABASE_URL` is missing or the connection fails, and every helper checks for this before executing queries. This allows the server to start and serve public routes even when the database is temporarily unavailable.

**AI Module.** Two AI capabilities are integrated. For conversational recommendations, `server/_core/glm4.ts` calls the Zhipu GLM-4 Flash model via the BigModel API. Before each request, the server fetches the user's favorites, liked posts, and (optionally) nearby restaurants from the database, injects them into a system prompt, then passes the full conversation history (last six turns) plus the new message to the model. For structured extraction, the same GLM-4 client is called in `json_object` response-format mode by `server/_core/voicePostExtractor.ts` to parse a voice transcript into `{ title, content, rating, restaurantNameHint, recommendedDish }`.

**Voice-to-Post Pipeline.** The browser records audio with the `MediaRecorder` API and sends it as a base64 data URL to `voice.transcribeDirect`. The server decodes the buffer and posts it directly to the OpenAI-compatible Whisper-1 endpoint exposed by the Manus Forge API, skipping a storage round-trip that would otherwise add 3–5 seconds of latency. The resulting transcript is passed to `voice.extractPost`, which calls GLM-4 to fill the publish form fields automatically.

**Manus Platform Services.** Authentication is delegated to the Manus OAuth server. On callback, the server validates the user's email against a domain allowlist (`@xjtlu.edu.cn`, `@student.xjtlu.edu.cn`) and issues a JWT session cookie. File storage (images and audio) is handled through the Manus Forge Storage proxy using pre-signed S3-compatible URLs. The AMap REST API provides reverse geocoding — coordinates from the browser's Geolocation API are converted to human-readable addresses on the server so the API key is never exposed to the client.

## Data Flow — Typical User Interaction

The following walkthrough traces a user publishing a voice review from start to finish.

1. **Authentication.** The user visits the app and is redirected to the Manus OAuth portal. After entering credentials, Manus posts an authorisation code to `/api/oauth/callback`. The server exchanges it for a user profile, upserts the user row in TiDB, and sets an `app_session_id` JWT cookie. All subsequent requests carry this cookie.

2. **Opening the Publish page.** The browser navigates to `/publish`. The React component renders; TanStack Query calls `auth.me` (a tRPC query) to confirm the session is valid. Because tRPC procedures use the same session cookie, no separate token exchange is needed.

3. **Recording a voice note.** The user taps the voice card and speaks their review. `MediaRecorder` captures an `audio/webm` blob and converts it to a base64 data URL in the browser.

4. **Transcription.** The client calls `voice.transcribeDirect` with the data URL. The Express handler decodes the base64 buffer, constructs a `multipart/form-data` body, and posts it to the Whisper-1 endpoint via Forge API. The transcribed text is returned to the client in ~2 seconds.

5. **AI extraction.** The client calls `voice.extractPost` with the transcript. The server sends the transcript to GLM-4 Flash with a JSON-mode system prompt. GLM-4 returns a structured JSON object (`title`, `content`, `rating`, `restaurantNameHint`, `recommendedDish`), which the server validates and returns. The client auto-fills the publish form.

6. **Submitting the post.** The user optionally adds photos, then submits. Each image is a base64 data URL; the `posts.create` tRPC mutation on the server decodes them, enforces a 10 MB per-image cap, and uploads them to Forge Storage, receiving permanent URLs. A single `INSERT` statement via Drizzle writes the post row (with image URL JSON array) to TiDB.

7. **Feed update.** Other users' `posts.getFeed` queries (polling via TanStack Query) return the new post. The feed supports both `latest` (ordered by `createdAt` DESC) and `hottest` (ordered by `likes + comments` DESC, then `createdAt` DESC) sort modes.

---

# Section 2 — Technology Justification

<table><tr><td>Technology / Tool</td><td>What we chose</td><td>Alternatives considered</td><td>Why we chose this</td></tr><tr><td>API layer</td><td>tRPC v11</td><td>REST (Express routes), GraphQL (Apollo)</td><td>tRPC derives client types directly from the server router — no schema file, no code-generation step, and TypeScript immediately surfaces breaking changes. REST would require manually keeping client fetch calls in sync; GraphQL adds a resolver layer and requires a code-gen pipeline, both increasing maintenance burden for a six-person team under a ten-day deadline.</td></tr><tr><td>Frontend framework</td><td>React 19 + Vite</td><td>Next.js, Vue 3, SvelteKit</td><td>The Manus deployment environment provides a Node.js server, not a serverless edge runtime, so Next.js's SSR model offered no benefit over a client-side SPA. Vue and Svelte were considered but the team had stronger React experience. Vite was chosen over Create React App because it starts instantly (ESM-native) and Hot Module Replacement is sub-second.</td></tr><tr><td>CSS / component system</td><td>Tailwind CSS v4 + shadcn/ui (Radix)</td><td>Chakra UI, Ant Design, Material UI</td><td>Tailwind v4 integrates directly with Vite via a plugin with no PostCSS config required. shadcn/ui generates accessible, unstyled component primitives from Radix UI into the project source, allowing full design customisation without fighting a component library's opinionated styles. Ant Design and MUI impose visual languages that conflict with the product's non-commercial branding goal.</td></tr><tr><td>Routing (client)</td><td>wouter v3</td><td>React Router v7, TanStack Router</td><td>wouter is 2 KB (vs React Router's ~50 KB) and provides a hooks-based API that is nearly identical to React Router's for simple SPAs. Since the app has fewer than ten routes and requires no data loaders or nested layouts, the full weight of React Router v7 or TanStack Router was unnecessary overhead.</td></tr><tr><td>ORM / database client</td><td>Drizzle ORM + mysql2</td><td>Prisma, TypeORM, raw mysql2</td><td>Drizzle is SQL-first: queries are written as composable TypeScript expressions that map 1:1 to SQL, which made it straightforward to write the Haversine distance sub-query for the nearby-restaurant feature. Prisma's query engine is a separate binary that adds ~30 MB and startup latency; TypeORM's decorator syntax does not compose well with newer TypeScript strict settings. Raw mysql2 would have required hand-written SQL for every query without type safety.</td></tr><tr><td>Database</td><td>TiDB (MySQL-compatible, hosted)</td><td>PostgreSQL (Supabase), MongoDB Atlas, SQLite</td><td>TiDB was provided as part of the Manus platform and required no additional account or billing setup. It exposes a MySQL-compatible wire protocol, so the standard mysql2 driver works unchanged. The distributed auto-increment IDs (which start in the hundreds of thousands) are a cosmetic difference with no functional impact. PostgreSQL on Supabase was the closest alternative but would have required migrating the schema and connection string format mid-sprint.</td></tr><tr><td>AI language model</td><td>Zhipu GLM-4 Flash</td><td>OpenAI GPT-4o-mini, Google Gemini Flash</td><td>GLM-4 Flash is trained specifically on Chinese-language corpora and produces more natural results for the Chinese restaurant-review domain than GPT-4o-mini at a comparable price point. Critically, the BigModel API (open.bigmodel.cn) does not require a VPN to access from mainland China, which mattered both for development and for users on campus. A second provider (Gemini) was proposed but rejected to keep the AI stack consistent and reduce debugging surface.</td></tr><tr><td>Speech-to-text</td><td>OpenAI Whisper-1 (via Manus Forge API)</td><td>Alibaba Cloud Paraformer, Baidu Speech</td><td>Whisper-1 supports over 90 languages including Chinese and English simultaneously, and the Manus Forge API already wraps it with the same authentication token used for file storage — one fewer credential to manage. Paraformer and Baidu Speech would have required separate API accounts and showed higher error rates on mixed Chinese–English food terminology in preliminary tests.</td></tr></table>

**Technical risks and mitigation.** The largest technical risk was the shared production database: the local development environment points at the same TiDB instance as the deployed application, meaning any `pnpm db:push` migration command would immediately ALTER live tables. The team mitigated this by resolving all schema evolution at the application layer — new columns are written into the `content` field as embedded JSON metadata and parsed at read time, rather than executing DDL against the shared schema. A second risk was Manus OAuth verification-code delivery failure, which blocked new user registration. Since the fix lives in Manus's backend (not the team's code), the workaround was a dev-only `/api/dev-login` backdoor for local testing and reliance on pre-registered accounts for user testing sessions.

---

# Section 3 — Deployment Guide

Write for someone who has never seen your project before. Number every step. Include exact commands where relevant.

## Environment requirements

<table><tr><td>Requirement</td><td>Version / Notes</td></tr><tr><td>Node.js</td><td>≥ 18.0.0 (native fetch and ESM required)</td></tr><tr><td>pnpm</td><td>10.4.1 (pinned via packageManager field; install with `npm i -g pnpm`)</td></tr><tr><td>MySQL-compatible database</td><td>TiDB Cloud or MySQL 8+ with SSL enabled</td></tr><tr><td>Manus account</td><td>Required for OAuth and Forge Storage credentials</td></tr><tr><td>Zhipu BigModel API key</td><td>For AI chat and voice extraction features</td></tr><tr><td>AMap Web Service API key</td><td>For reverse geocoding (optional — app degrades gracefully without it)</td></tr></table>

## Setup steps

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd chileoma
   ```

2. **Install dependencies** (must use pnpm, not npm or yarn):
   ```
   pnpm install
   ```

3. **Create the environment file.** Copy the example below into a file named `.env` at the project root. The file **must use LF line endings** (not CRLF); Windows users should configure their editor accordingly or run `dos2unix .env` after saving.
   ```
   DATABASE_URL=mysql://user:password@host:4000/dbname?ssl={"rejectUnauthorized":true}
   JWT_SECRET=any-long-random-string
   VITE_APP_ID=your-manus-app-id
   VITE_OAUTH_PORTAL_URL=https://your-manus-oauth-portal-url
   OAUTH_SERVER_URL=https://your-manus-oauth-server-url
   OWNER_OPEN_ID=the-openId-that-should-become-super_admin
   BUILT_IN_FORGE_API_URL=https://your-forge-api-url
   BUILT_IN_FORGE_API_KEY=your-forge-api-key
   GLM4_API_KEY=your-zhipu-api-key
   AMAP_API_KEY=your-amap-web-service-key
   ```
   All values for `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_URL`, and `BUILT_IN_FORGE_API_KEY` are obtained from the Manus developer console.

4. **Push the database schema.** This command generates and applies Drizzle migrations. Run it only once against a fresh database — do **not** run it against the shared production database.
   ```
   pnpm db:push
   ```

5. **Start the development server:**
   ```
   pnpm dev
   ```
   The server starts on port 3000 by default. If that port is busy, the auto-port-bump logic will try 3001, 3002, and so on — watch the console output for the actual URL.

6. **Verify it is working.** Open `http://localhost:3000` in a browser. You should see the Chileoma home page. In development mode, a yellow "Dev Login" banner appears at the top; click it to log in as the owner account without going through Manus OAuth. If the banner does not appear, check that `NODE_ENV` is not set to `production` in your shell.

7. **Build for production:**
   ```
   pnpm build
   pnpm start
   ```
   `pnpm build` compiles the React client into `dist/public` and bundles the Express server into `dist/index.js`. `pnpm start` runs the bundled server in production mode — the yellow dev banner is absent and the OAuth backdoor is disabled.

## Common issues and solutions

<table><tr><td>Problem</td><td>Likely cause</td><td>Solution</td></tr><tr><td>Only the first environment variable is recognised; all others appear as `undefined`</td><td>The `.env` file was saved with Windows CRLF line endings. Node's `dotenv` treats the entire file as one line.</td><td>Re-save the file with LF endings: in VS Code, click "CRLF" in the status bar and switch to "LF", then save.</td></tr><tr><td>Clicking "Login" redirects to a CloudFront 403 error page</td><td>The Manus OAuth portal's redirect-URI whitelist does not include `http://localhost:3000`. This is a Manus platform configuration issue, not a code bug.</td><td>In development, use the yellow "Dev Login" banner instead. For production, ensure the deployed URL is registered in the Manus developer console as a valid callback.</td></tr><tr><td>All feed and restaurant pages show empty states despite data existing in the database</td><td>The `DATABASE_URL` is missing, malformed, or the TiDB SSL certificate is rejected.</td><td>Confirm that the `?ssl={"rejectUnauthorized":true}` suffix is present in `DATABASE_URL` and that the host and credentials are correct. Run `pnpm test` — if DB-dependent tests fail with connection errors, the URL is the problem.</td></tr><tr><td>Voice-to-post returns "音频上传失败" (audio upload failed)</td><td>`BUILT_IN_FORGE_API_URL` or `BUILT_IN_FORGE_API_KEY` is not set or is incorrect.</td><td>Verify both Forge credentials in `.env`. The Forge API key is the same key used for image uploads; if image upload works, verify the URL path includes a trailing slash.</td></tr></table>

---

# Section 4 — IP Strategy

## Novelty analysis

Chileoma's novel contribution is not any individual technical component — each piece (OAuth, tRPC, LLM chat, STT) exists as an open-source or API product — but the specific combination applied to a problem that mainstream platforms structurally cannot solve: **a zero-commercial-incentive dining community for a small, verifiable closed group**.

Existing food-review platforms (Meituan, Dianping, OpenRice, Yelp) are designed to monetise the relationship between diners and restaurants. Their incentive structure produces sponsored results, pay-to-rank listings, and review fraud. Chileoma removes the commercial layer entirely by design: there is no merchant registration, no paid promotion, and no algorithmic feed manipulation. The email-domain allowlist (enforced at the OAuth callback in `server/_core/oauth.ts`) makes the trust guarantee technically verifiable rather than a policy claim — every post is provably authored by an XJTLU community member.

Within that framing, the **voice-to-post pipeline** is a genuinely product-level innovation for student user research. Students are unwilling to type detailed reviews on a mobile device; a 30-second voice note transcribed and structured by the AI removes the authoring friction entirely. The pipeline — `MediaRecorder` → Whisper-1 → GLM-4 JSON extraction → auto-filled publish form — was built and shipped within 24 hours and represents a concrete AI-native feature that is absent from all comparable campus platforms.

## Prior art

<table><tr><td>Existing product / patent</td><td>What it does</td><td>How our solution differs</td></tr><tr><td>Meituan (美团) — commercial food discovery and delivery super-app</td><td>Aggregates restaurant listings, user reviews, and delivery fulfilment. Merchants pay for placement; algorithm weights paid promotion. Available to any user with a Chinese phone number.</td><td>Chileoma has no merchant accounts, no paid ranking, and is restricted to verified XJTLU email addresses. It cannot scale to become Meituan because the closed-community trust model is the core value proposition — opening registration would destroy the product's differentiation.</td></tr><tr><td>Dianping (大众点评) — user-review platform owned by Meituan</td><td>Crowd-sourced restaurant reviews open to all users. Employs algorithmic curation and allows businesses to respond to or suppress reviews commercially.</td><td>Dianping has a history of review manipulation and suppression of negative content from paying merchants (Reuters, 2019). Chileoma's admin tooling (admin role can moderate content, but cannot alter ratings or hide posts from the feed algorithmically) is architecturally incapable of merchant-driven review manipulation.</td></tr><tr><td>OpenRice (开饭喇) — Hong Kong–based restaurant discovery platform</td><td>Regional food review aggregator with user ratings and photos, historically popular in Hong Kong and Southeast Asia.</td><td>OpenRice is geographically open, commercially operated, and does not apply AI to content creation. Chileoma's AI-assisted publishing (voice → structured post) and location-aware personalised recommendation via GLM-4 are absent from OpenRice's feature set.</td></tr></table>

## Patent decision

**No.** Seeking a patent is not recommended for three reasons. First, the core innovation is a system-level combination of existing technologies rather than a novel algorithm or hardware invention — this combination does not meet the non-obviousness threshold required for a software patent in most jurisdictions. Second, patent prosecution in China or the UK typically costs ¥50,000–200,000 and takes two to four years to grant; for a student project, the cost–benefit ratio is negative. Third, even if a patent were granted, enforcement against a large incumbent platform (which could independently implement the same design pattern) would be prohibitively expensive. The competitive advantage of Chileoma does not reside in protectable technical novelty — it resides in the network effect of a trusted closed community.

## Alternative protection

**Network effects as the primary moat.** A closed-community platform's value grows with its number of verified contributors. Once a critical mass of XJTLU students have published reviews, the accumulated authentic content is hard to replicate: competitors cannot simply copy the database because the value lies in community trust, not raw data. This is the same dynamic that made early Facebook defensible against MySpace despite inferior features — a smaller, more credible network outperforms a larger, noisier one for its target audience.

**Trade secret in operational design.** The email-domain allowlist logic, the voice-to-post prompt engineering (the GLM-4 system prompt that extracts structured restaurant data from colloquial speech), and the specific combination of personalisation signals (liked posts + favorites + nearby restaurants injected into the AI context) can be kept as internal implementation details. None of these are discoverable from the public product surface, and none require disclosure to operate.

---

# Section 5 — Limitations & Future Work

## Known limitations

<table><tr><td>Limitation</td><td>Why it exists</td><td>Impact on users</td></tr><tr><td>Single-process, single-instance deployment</td><td>Chosen deliberately to minimise infrastructure complexity during the sprint. All compute — API handling, database queries, AI calls, file upload — runs in one Node.js thread.</td><td>A spike in concurrent users (e.g., a shared link going viral in a student WeChat group) could block the event loop and make the app temporarily unresponsive. Acceptable for an MVP with a controlled user group; not acceptable at scale.</td></tr><tr><td>Shared production and development database</td><td>Creating a separate TiDB instance and seeding it with representative data was estimated at 2–3 days of effort during a ten-day sprint. The trade-off was made explicitly to preserve development velocity.</td><td>A developer running schema migrations or inserting test data locally affects production data immediately. A pre-Demo Day manual cleanup of test posts is required. There is no safety net if a destructive migration is accidentally run.</td></tr><tr><td>New user registration blocked by Manus OAuth verification-code delivery failure</td><td>Verification codes are sent by Manus's backend, not the application. The fix requires a Manus support ticket, not a code change.</td><td>During user testing, only pre-registered accounts can log in. This constrains how many external testers the team can onboard without manual intervention from Manus support.</td></tr><tr><td>Voice-to-post lacks restaurant POI anchoring</td><td>Integrating AMap POI search to map a spoken restaurant name to a canonical database entry was estimated at 4–5 days. The MVP scope was reduced to name extraction only.</td><td>If a user says "the ramen place in Wanda Plaza," the AI correctly extracts the name hint but the post is not linked to a restaurant record in the database. The restaurant relationship is optional in the schema, so data integrity is maintained, but the feed lacks restaurant-level aggregation for voice posts.</td></tr><tr><td>No client-side test coverage</td><td>The test runner (Vitest in Node environment) is configured for server-side code only. Setting up jsdom or a Playwright test suite was deprioritised against feature delivery.</td><td>UI regressions (e.g., the publish form silently dropping image data, or the AI chat scroll behaviour breaking on mobile) can only be caught by manual testing. A regression that survives a `pnpm test` run may still break the demo.</td></tr></table>

## Future work

- **Restaurant POI anchoring via AMap.** When a user speaks or types a restaurant name, a fuzzy-match call to the AMap Place Search API could return a canonical POI record (name, coordinates, category). Linking voice posts to verified POI entries would enable restaurant-level rating aggregation and map-based discovery — features that would significantly strengthen the product's value proposition beyond a text feed.

- **Progressive Web App (PWA) packaging.** The current frontend is a responsive web app but is not installable on a home screen without a native shell. Adding a service worker and web manifest would allow Android/iOS users to install Chileoma as a PWA, enabling push notifications for new posts and offline reading of cached content. This would meaningfully reduce the friction of daily active use.

- **Isolated development database with seed data.** A separate TiDB Serverless instance for development, pre-populated with realistic seed data (10–20 restaurants, 30–50 posts from mock users), would eliminate the production-data contamination risk and allow developers to test empty-state, partial-data, and full-data UI states safely.

- **Technical debt: schema evolution strategy.** The current workaround of embedding new fields as JSON inside the `content` column is a temporary measure. Once the production database is isolated from local development, all new columns should be added via `pnpm db:push` and the embedded-metadata read/write logic should be removed. The schema is small enough that this migration would take less than a day.

- **Open research question: anti-gaming for the hottest feed.** The `hottest` sort currently weights `likes + comments` equally, which is susceptible to coordinated boosting by a small group of users. Designing a decay function (e.g., likes scored by time since posting, with diminishing returns per user) that resists gaming while remaining interpretable to students is a product research question that requires real usage data to answer.

---

# References

APA 7th edition. References are not counted in the page limit.

Drizzle ORM. (2024). *Drizzle ORM documentation*. https://orm.drizzle.team/docs/overview

Meta Open Source. (2024). *React 19 documentation*. https://react.dev

OpenAI. (2024). *Whisper model card*. https://openai.com/research/whisper

PingCAP. (2024). *TiDB cloud documentation*. https://docs.pingcap.com/tidbcloud/

Reuters. (2019, March 14). *China's Dianping allows restaurants to hide bad reviews for a fee*. Reuters. https://www.reuters.com/article/us-china-reviews-idUSKCN1QV0GY

tRPC. (2024). *tRPC documentation — TypeScript end-to-end typesafe APIs*. https://trpc.io/docs

Vite. (2024). *Vite documentation*. https://vitejs.dev/guide/

Zhipu AI. (2024). *GLM-4 model documentation*. https://open.bigmodel.cn/dev/api/normal-model/glm-4
