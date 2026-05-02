/**
 * One-time backfill script: classify existing posts and embed cuisine + pricePerPerson
 * into the <!--chileoma-meta:--> content marker.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-cuisine.ts            # live run
 *   pnpm tsx scripts/backfill-cuisine.ts --dry-run  # preview only, no writes
 *
 * Rate-limited to 1 req/sec to respect GLM-4 limits.
 * Idempotent: skips posts that already have "cuisine": in their content.
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { sql, like, notLike } from "drizzle-orm";
import { classifyPost } from "../server/_core/postClassifier";

const DRY_RUN = process.argv.includes("--dry-run");

const LEGACY_META_PREFIX = "<!--chileoma-meta:";
const LEGACY_META_SUFFIX = "-->";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL not set");
    process.exit(1);
  }

  console.log(DRY_RUN ? "🔍 DRY RUN — no writes will happen" : "✍️  LIVE RUN — writing to database");

  const db = drizzle(process.env.DATABASE_URL);

  // Fetch posts without cuisine classification
  const rows = await db.execute(
    sql`SELECT id, title, content FROM posts WHERE content NOT LIKE '%"cuisine":%' LIMIT 200`
  );
  const posts = rows[0] as Array<{ id: number; title: string; content: string | null }>;

  console.log(`\nFound ${posts.length} posts to classify\n`);
  if (posts.length === 0) { console.log("✅ Nothing to do."); return; }

  let done = 0;
  for (const post of posts) {
    const title = post.title ?? "";
    const content = post.content ?? "";

    // Classify
    let classification;
    try {
      classification = await classifyPost(title, content);
    } catch {
      console.warn(`  [${post.id}] classify error — skipping`);
      continue;
    }

    console.log(`  [${post.id}] "${title.slice(0, 30)}…" → ${classification.cuisine} / ${classification.pricePerPerson}${classification.restaurantHint ? ` / ${classification.restaurantHint}` : ""}`);

    if (!DRY_RUN) {
      // Merge into existing meta block or append new one
      let updatedContent = content;
      const start = content.lastIndexOf(LEGACY_META_PREFIX);
      const end = content.lastIndexOf(LEGACY_META_SUFFIX);
      if (start !== -1 && end !== -1 && end > start) {
        // Parse existing meta and merge
        const jsonStart = start + LEGACY_META_PREFIX.length;
        const jsonRaw = content.slice(jsonStart, end).trim();
        let existing: Record<string, unknown> = {};
        try { existing = JSON.parse(jsonRaw) as Record<string, unknown>; } catch { /* ignore */ }
        const merged = {
          ...existing,
          cuisine: classification.cuisine,
          pricePerPerson: classification.pricePerPerson,
          ...(classification.restaurantHint ? { restaurantHint: classification.restaurantHint } : {}),
        };
        const base = content.slice(0, start).trimEnd();
        const newMarker = `${LEGACY_META_PREFIX}${JSON.stringify(merged)}${LEGACY_META_SUFFIX}`;
        updatedContent = base ? `${base}\n\n${newMarker}` : newMarker;
      } else {
        // Append new meta block
        const meta: Record<string, unknown> = {
          cuisine: classification.cuisine,
          pricePerPerson: classification.pricePerPerson,
          ...(classification.restaurantHint ? { restaurantHint: classification.restaurantHint } : {}),
        };
        const marker = `${LEGACY_META_PREFIX}${JSON.stringify(meta)}${LEGACY_META_SUFFIX}`;
        updatedContent = content.trim() ? `${content.trim()}\n\n${marker}` : marker;
      }
      await db.execute(sql`UPDATE posts SET content = ${updatedContent} WHERE id = ${post.id}`);
    }

    done++;
    // Rate limit: 1 req/sec
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n${DRY_RUN ? "Would classify" : "Classified"} ${done} / ${posts.length} posts.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
