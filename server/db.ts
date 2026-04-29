import { eq, desc, and, count, sql, avg, like, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, posts, restaurants, comments, userProfiles, favorites, aiRecommendations, postLikes, commentLikes } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _hasExtendedPostColumns: boolean | null = null;
let _hasExtendedPostColumnsPromise: Promise<boolean> | null = null;
const LEGACY_META_PREFIX = "<!--chileoma-meta:";
const LEGACY_META_SUFFIX = "-->";

type PostTypeValue = 'delivery' | 'dine-in';

type LegacyPostMeta = {
  postType: PostTypeValue | null;
  tasteRating: number | null;
  valueRating: number | null;
  location: string | null;
};

const EMPTY_LEGACY_POST_META: LegacyPostMeta = {
  postType: null,
  tasteRating: null,
  valueRating: null,
  location: null,
};

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function isUnknownColumnError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Unknown column");
}

async function hasExtendedPostColumns(): Promise<boolean> {
  if (_hasExtendedPostColumns !== null) {
    return _hasExtendedPostColumns;
  }

  if (_hasExtendedPostColumnsPromise) {
    return _hasExtendedPostColumnsPromise;
  }

  _hasExtendedPostColumnsPromise = (async () => {
    const db = await getDb();
    if (!db) {
      _hasExtendedPostColumns = false;
      return false;
    }

    try {
      await db.execute(sql`SELECT postType, tasteRating, valueRating, location FROM posts LIMIT 1`);
      _hasExtendedPostColumns = true;
      return true;
    } catch (error) {
      if (isUnknownColumnError(error)) {
        console.warn("[Database] posts table is using legacy schema; extended post fields are disabled.");
      }
      _hasExtendedPostColumns = false;
      return false;
    } finally {
      _hasExtendedPostColumnsPromise = null;
    }
  })();

  return _hasExtendedPostColumnsPromise;
}

function withLegacyPostDefaults<T extends Record<string, unknown>>(rows: T[]): Array<T & {
  postType: PostTypeValue;
  tasteRating: number | null;
  valueRating: number | null;
  location: string | null;
}> {
  return rows.map((row) => {
    const parsed = extractLegacyPostMetaFromContent(row);
    return {
      ...row,
      content: parsed.content,
      postType: parsed.postType ?? 'dine-in',
      tasteRating: parsed.tasteRating,
      valueRating: parsed.valueRating,
      location: parsed.location,
    };
  });
}

function normalizeRating(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

function normalizePostType(value: unknown): PostTypeValue | null {
  if (value === 'delivery' || value === 'dine-in') return value;
  return null;
}

function normalizeLocation(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 255) : null;
}

function serializeLegacyPostMeta(content: string | null | undefined, meta: LegacyPostMeta): string | null {
  const hasMeta = meta.postType || meta.tasteRating || meta.valueRating || meta.location;
  const base = (content ?? '').trim();
  if (!hasMeta) {
    return base || null;
  }

  const encoded = JSON.stringify(meta);
  const marker = `${LEGACY_META_PREFIX}${encoded}${LEGACY_META_SUFFIX}`;
  return base ? `${base}\n\n${marker}` : marker;
}

function parseLegacyPostMeta(raw: string): LegacyPostMeta {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      postType: normalizePostType(parsed.postType),
      tasteRating: normalizeRating(parsed.tasteRating),
      valueRating: normalizeRating(parsed.valueRating),
      location: normalizeLocation(parsed.location),
    };
  } catch {
    return EMPTY_LEGACY_POST_META;
  }
}

function extractLegacyPostMetaFromContent<T extends Record<string, unknown>>(row: T): {
  content: string | null | undefined;
  postType: PostTypeValue | null;
  tasteRating: number | null;
  valueRating: number | null;
  location: string | null;
} {
  const contentRaw = row.content;
  if (typeof contentRaw !== 'string') {
    return {
      content: contentRaw as string | null | undefined,
      ...EMPTY_LEGACY_POST_META,
    };
  }

  const start = contentRaw.lastIndexOf(LEGACY_META_PREFIX);
  const end = contentRaw.lastIndexOf(LEGACY_META_SUFFIX);
  if (start === -1 || end === -1 || end <= start) {
    return { content: contentRaw, ...EMPTY_LEGACY_POST_META };
  }

  const jsonStart = start + LEGACY_META_PREFIX.length;
  const jsonRaw = contentRaw.slice(jsonStart, end).trim();
  const meta = parseLegacyPostMeta(jsonRaw);
  const clean = contentRaw.slice(0, start).trimEnd();

  return {
    content: clean || null,
    ...meta,
  };
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      // Owner gets super_admin on first insert, but never overwrite existing role on update
      values.role = 'super_admin';
      // Do NOT add to updateSet - this ensures role is only set on INSERT, not on duplicate key UPDATE
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Posts queries
export async function createPost(post: typeof posts.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!(await hasExtendedPostColumns())) {
    const legacyMeta: LegacyPostMeta = {
      postType: normalizePostType(post.postType),
      tasteRating: normalizeRating(post.tasteRating),
      valueRating: normalizeRating(post.valueRating),
      location: normalizeLocation(post.location),
    };
    const legacyPost: typeof posts.$inferInsert = {
      userId: post.userId,
      title: post.title,
      content: serializeLegacyPostMeta(post.content ?? null, legacyMeta),
      images: post.images ?? null,
      restaurantId: post.restaurantId ?? null,
      rating: post.rating ?? null,
    };
    return db.execute(sql`
      INSERT INTO posts (
        userId,
        title,
        content,
        images,
        restaurantId,
        rating
      ) VALUES (
        ${legacyPost.userId},
        ${legacyPost.title},
        ${legacyPost.content},
        ${legacyPost.images},
        ${legacyPost.restaurantId},
        ${legacyPost.rating}
      )
    `);
  }
  return db.insert(posts).values(post);
}

export async function getPostsByUserId(userId: number, limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  if (!(await hasExtendedPostColumns())) {
    const legacyResult = await db.select({
      id: posts.id,
      userId: posts.userId,
      title: posts.title,
      content: posts.content,
      images: posts.images,
      restaurantId: posts.restaurantId,
      rating: posts.rating,
      likes: posts.likes,
      comments: posts.comments,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      userName: users.name,
    }).from(posts).leftJoin(users, eq(posts.userId, users.id)).where(eq(posts.userId, userId)).orderBy(desc(posts.createdAt)).limit(limit).offset(offset);
    return withLegacyPostDefaults(legacyResult);
  }

  const result = await db.select({
    id: posts.id,
    userId: posts.userId,
    title: posts.title,
    content: posts.content,
    images: posts.images,
    restaurantId: posts.restaurantId,
    rating: posts.rating,
    postType: posts.postType,
    tasteRating: posts.tasteRating,
    valueRating: posts.valueRating,
    location: posts.location,
    likes: posts.likes,
    comments: posts.comments,
    createdAt: posts.createdAt,
    updatedAt: posts.updatedAt,
    userName: users.name,
  }).from(posts).leftJoin(users, eq(posts.userId, users.id)).where(eq(posts.userId, userId)).orderBy(desc(posts.createdAt)).limit(limit).offset(offset);
  return result;
}

export type FeedSort = 'latest' | 'hottest';

export async function getPostsForFeed(limit: number = 20, offset: number = 0, sort: FeedSort = 'latest') {
  const db = await getDb();
  if (!db) return [];
  const hotScore = sql<number>`COALESCE(${posts.likes}, 0) + COALESCE(${posts.comments}, 0)`;
  const orderByClause = sort === 'hottest'
    ? [desc(hotScore), desc(posts.createdAt)]
    : [desc(posts.createdAt)];

  if (!(await hasExtendedPostColumns())) {
    const legacyResult = await db.select({
      id: posts.id,
      userId: posts.userId,
      title: posts.title,
      content: posts.content,
      images: posts.images,
      restaurantId: posts.restaurantId,
      rating: posts.rating,
      likes: posts.likes,
      comments: posts.comments,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      userName: users.name,
    }).from(posts).leftJoin(users, eq(posts.userId, users.id)).orderBy(...orderByClause).limit(limit).offset(offset);
    return withLegacyPostDefaults(legacyResult);
  }

  const result = await db.select({
    id: posts.id,
    userId: posts.userId,
    title: posts.title,
    content: posts.content,
    images: posts.images,
    restaurantId: posts.restaurantId,
    rating: posts.rating,
    postType: posts.postType,
    tasteRating: posts.tasteRating,
    valueRating: posts.valueRating,
    location: posts.location,
    likes: posts.likes,
    comments: posts.comments,
    createdAt: posts.createdAt,
    updatedAt: posts.updatedAt,
    userName: users.name,
  }).from(posts).leftJoin(users, eq(posts.userId, users.id)).orderBy(...orderByClause).limit(limit).offset(offset);
  return result;
}

export async function getPostById(postId: number) {
  const db = await getDb();
  if (!db) return undefined;

  if (!(await hasExtendedPostColumns())) {
    const legacyResult = await db.select({
      id: posts.id,
      userId: posts.userId,
      title: posts.title,
      content: posts.content,
      images: posts.images,
      restaurantId: posts.restaurantId,
      rating: posts.rating,
      likes: posts.likes,
      comments: posts.comments,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      userName: users.name,
    }).from(posts).leftJoin(users, eq(posts.userId, users.id)).where(eq(posts.id, postId)).limit(1);

    return withLegacyPostDefaults(legacyResult)[0];
  }

  const result = await db.select({
    id: posts.id,
    userId: posts.userId,
    title: posts.title,
    content: posts.content,
    images: posts.images,
    restaurantId: posts.restaurantId,
    rating: posts.rating,
    postType: posts.postType,
    tasteRating: posts.tasteRating,
    valueRating: posts.valueRating,
    location: posts.location,
    likes: posts.likes,
    comments: posts.comments,
    createdAt: posts.createdAt,
    updatedAt: posts.updatedAt,
    userName: users.name,
  }).from(posts).leftJoin(users, eq(posts.userId, users.id)).where(eq(posts.id, postId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deletePost(postId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(posts).where(eq(posts.id, postId));
}

// Restaurant queries
export async function createRestaurant(restaurant: typeof restaurants.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(restaurants).values(restaurant);
}

export async function getRestaurantById(restaurantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRestaurantsByCity(city: string, limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(restaurants).where(eq(restaurants.city, city)).limit(limit).offset(offset);
}

export async function getRestaurantsByDistrict(city: string, district: string, limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(restaurants).where(and(eq(restaurants.city, city), eq(restaurants.district, district))).limit(limit).offset(offset);
}

export async function searchRestaurants(q: string, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  const keyword = q.trim();
  if (!keyword) return [];

  return db
    .select({
      id: restaurants.id,
      name: restaurants.name,
      cuisine: restaurants.cuisine,
      address: restaurants.address,
    })
    .from(restaurants)
    .where(and(eq(restaurants.status, 'published'), like(restaurants.name, `%${keyword}%`)))
    .limit(limit);
}

// User Profile queries
export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  if (result.length > 0) {
    return result[0];
  }
  // Create default profile if it doesn't exist
  const defaultProfile = {
    userId,
    phone: null,
    wechatId: null,
    qqId: null,
    avatar: null,
    bio: null,
    location: null,
    latitude: null,
    longitude: null,
    preferences: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return defaultProfile;
}

export async function createOrUpdateUserProfile(profile: typeof userProfiles.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getUserProfile(profile.userId);
  if (existing) {
    return db.update(userProfiles).set(profile).where(eq(userProfiles.userId, profile.userId));
  } else {
    return db.insert(userProfiles).values(profile);
  }
}

// Favorites queries
export async function addFavorite(userId: number, restaurantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(favorites).values({ userId, restaurantId });
}

export async function removeFavorite(userId: number, restaurantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.restaurantId, restaurantId)));
}

export async function getUserFavorites(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(favorites).where(eq(favorites.userId, userId));
}

// Comments queries
export async function createComment(comment: typeof comments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(comments).values(comment);
  // Update post comment count
  const post = await getPostById(comment.postId);
  if (post) {
    const newCommentCount = (post.comments || 0) + 1;
    await db.update(posts).set({ comments: newCommentCount }).where(eq(posts.id, comment.postId));
  }
  return result;
}

export async function getCommentsByPostId(postId: number, limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    id: comments.id,
    postId: comments.postId,
    userId: comments.userId,
    content: comments.content,
    likes: comments.likes,
    createdAt: comments.createdAt,
    updatedAt: comments.updatedAt,
    userName: users.name,
  }).from(comments).leftJoin(users, eq(comments.userId, users.id)).where(eq(comments.postId, postId)).orderBy(desc(comments.createdAt)).limit(limit).offset(offset);
  return result;
}

export async function getCommentById(commentId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({
    id: comments.id,
    postId: comments.postId,
    userId: comments.userId,
    content: comments.content,
    likes: comments.likes,
    createdAt: comments.createdAt,
    updatedAt: comments.updatedAt,
  }).from(comments).where(eq(comments.id, commentId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function deleteComment(commentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Get comment to find postId
  const comment = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
  if (comment.length > 0) {
    const postId = comment[0].postId;
    const post = await getPostById(postId);
    if (post) {
      const newCommentCount = Math.max(0, (post.comments || 0) - 1);
      await db.update(posts).set({ comments: newCommentCount }).where(eq(posts.id, postId));
    }
  }
  return db.delete(comments).where(eq(comments.id, commentId));
}

// Likes queries
// ===== 点赞功能（持久化到 postLikes/commentLikes 表） =====

export async function likePost(userId: number, postId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const post = await getPostById(postId);
  if (!post) return null;
  // Check if already liked
  const existing = await db.select().from(postLikes).where(and(eq(postLikes.userId, userId), eq(postLikes.postId, postId))).limit(1);
  if (existing.length > 0) return { alreadyLiked: true };
  // Insert like record
  await db.insert(postLikes).values({ userId, postId });
  // Update post likes count
  const newLikes = (post.likes || 0) + 1;
  await db.update(posts).set({ likes: newLikes }).where(eq(posts.id, postId));
  return { success: true };
}

export async function unlikePost(userId: number, postId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const post = await getPostById(postId);
  if (!post) return null;
  // Check if liked
  const existing = await db.select().from(postLikes).where(and(eq(postLikes.userId, userId), eq(postLikes.postId, postId))).limit(1);
  if (existing.length === 0) return { notLiked: true };
  // Delete like record
  await db.delete(postLikes).where(and(eq(postLikes.userId, userId), eq(postLikes.postId, postId)));
  // Update post likes count
  const newLikes = Math.max((post.likes || 0) - 1, 0);
  await db.update(posts).set({ likes: newLikes }).where(eq(posts.id, postId));
  return { success: true };
}

export async function getMyLikedPosts(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ postId: postLikes.postId }).from(postLikes).where(eq(postLikes.userId, userId));
  return result.map(r => r.postId);
}

export async function getMyLikedPostsWithDetails(userId: number, limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];

  if (!(await hasExtendedPostColumns())) {
    const legacyResult = await db.select({
      id: posts.id,
      userId: posts.userId,
      title: posts.title,
      content: posts.content,
      images: posts.images,
      restaurantId: posts.restaurantId,
      rating: posts.rating,
      likes: posts.likes,
      comments: posts.comments,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      userName: users.name,
    }).from(postLikes)
      .innerJoin(posts, eq(postLikes.postId, posts.id))
      .leftJoin(users, eq(posts.userId, users.id))
      .where(eq(postLikes.userId, userId))
      .orderBy(desc(postLikes.createdAt))
      .limit(limit).offset(offset);
    return withLegacyPostDefaults(legacyResult);
  }

  const result = await db.select({
    id: posts.id,
    userId: posts.userId,
    title: posts.title,
    content: posts.content,
    images: posts.images,
    restaurantId: posts.restaurantId,
    rating: posts.rating,
    postType: posts.postType,
    tasteRating: posts.tasteRating,
    valueRating: posts.valueRating,
    location: posts.location,
    likes: posts.likes,
    comments: posts.comments,
    createdAt: posts.createdAt,
    updatedAt: posts.updatedAt,
    userName: users.name,
  }).from(postLikes)
    .innerJoin(posts, eq(postLikes.postId, posts.id))
    .leftJoin(users, eq(posts.userId, users.id))
    .where(eq(postLikes.userId, userId))
    .orderBy(desc(postLikes.createdAt))
    .limit(limit).offset(offset);
  return result;
}

export async function getMyLikedComments(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ commentId: commentLikes.commentId }).from(commentLikes).where(eq(commentLikes.userId, userId));
  return result.map(r => r.commentId);
}

export async function likeComment(userId: number, commentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
  if (result.length === 0) return null;
  // Check if already liked
  const existing = await db.select().from(commentLikes).where(and(eq(commentLikes.userId, userId), eq(commentLikes.commentId, commentId))).limit(1);
  if (existing.length > 0) return { alreadyLiked: true };
  // Insert like record
  await db.insert(commentLikes).values({ userId, commentId });
  // Update comment likes count
  const comment = result[0];
  const newLikes = (comment.likes || 0) + 1;
  await db.update(comments).set({ likes: newLikes }).where(eq(comments.id, commentId));
  return { success: true };
}

export async function unlikeComment(userId: number, commentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
  if (result.length === 0) return null;
  // Check if liked
  const existing = await db.select().from(commentLikes).where(and(eq(commentLikes.userId, userId), eq(commentLikes.commentId, commentId))).limit(1);
  if (existing.length === 0) return { notLiked: true };
  // Delete like record
  await db.delete(commentLikes).where(and(eq(commentLikes.userId, userId), eq(commentLikes.commentId, commentId)));
  // Update comment likes count
  const comment = result[0];
  const newLikes = Math.max((comment.likes || 0) - 1, 0);
  await db.update(comments).set({ likes: newLikes }).where(eq(comments.id, commentId));
  return { success: true };
}

// AI Recommendations queries
export async function createAiRecommendation(recommendation: typeof aiRecommendations.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(aiRecommendations).values(recommendation);
}

export async function getUserAiRecommendations(userId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiRecommendations).where(eq(aiRecommendations.userId, userId)).orderBy(desc(aiRecommendations.createdAt)).limit(limit);
}

export type RankingDimension = 'overall' | 'hotThisWeek' | 'topRated' | 'bestValue' | 'newlyFamous';

// Rankings queries (real-time from posts)
export async function getRestaurantRankings(dimension: RankingDimension, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

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
    .innerJoin(posts, and(eq(posts.restaurantId, restaurants.id), isNotNull(posts.rating)))
    .where(eq(restaurants.status, 'published'))
    .groupBy(restaurants.id);

  const filtered = rows.filter((row) => {
    if (dimension === 'bestValue') {
      return row.priceLevel === '便宜';
    }
    if (dimension === 'newlyFamous') {
      return new Date(row.createdAt) >= thirtyDaysAgo;
    }
    return true;
  });

  const scored = filtered.map((row) => {
    const avgRatingValue = Number.parseFloat(String(row.avgRating ?? '0'));
    const postCountValue = Number(row.postCount ?? 0);
    const weekPostsValue = Number(row.weekPosts ?? 0);

    const avgRatingSafe = Number.isFinite(avgRatingValue) ? avgRatingValue : 0;
    const postCountSafe = Number.isFinite(postCountValue) ? postCountValue : 0;
    const weekPostsSafe = Number.isFinite(weekPostsValue) ? weekPostsValue : 0;

    let score = 0;
    if (dimension === 'overall') score = 0.6 * avgRatingSafe + 0.4 * Math.log(postCountSafe + 1);
    if (dimension === 'hotThisWeek') score = weekPostsSafe;
    if (dimension === 'topRated') score = avgRatingSafe;
    if (dimension === 'bestValue') score = avgRatingSafe;
    if (dimension === 'newlyFamous') score = avgRatingSafe;

    return {
      ...row,
      avgRating: avgRatingSafe,
      postCount: postCountSafe,
      weekPosts: weekPostsSafe,
      score,
    };
  });

  return scored
    .sort((a, b) => b.score - a.score || b.avgRating - a.avgRating || b.postCount - a.postCount)
    .slice(0, limit);
}


// User name update
export async function updateUserName(userId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!name || name.trim().length === 0) throw new Error("Name cannot be empty");
  return db.update(users).set({ name: name.trim() }).where(eq(users.id, userId));
}

// ==================== Admin queries ====================

export async function getAllRestaurantsAdmin(limit: number = 100, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(restaurants).orderBy(desc(restaurants.createdAt)).limit(limit).offset(offset);
}

export async function createRestaurantAdmin(data: typeof restaurants.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(restaurants).values(data);
}

export async function updateRestaurant(id: number, data: Partial<typeof restaurants.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(restaurants).set({ ...data, updatedAt: new Date() }).where(eq(restaurants.id, id));
}

export async function deleteRestaurant(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(restaurants).where(eq(restaurants.id, id));
}

export async function updateRestaurantStatus(id: number, status: "published" | "pending" | "rejected") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(restaurants).set({ status, updatedAt: new Date() }).where(eq(restaurants.id, id));
}

export async function getAdminStats() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, totalPosts: 0, totalRestaurants: 0, pendingRestaurants: 0 };
  const [usersCount] = await db.select({ count: count() }).from(users);
  const [postsCount] = await db.select({ count: count() }).from(posts);
  const [restaurantsCount] = await db.select({ count: count() }).from(restaurants);
  const [pendingCount] = await db.select({ count: count() }).from(restaurants).where(eq(restaurants.status, 'pending'));
  return {
    totalUsers: usersCount?.count ?? 0,
    totalPosts: postsCount?.count ?? 0,
    totalRestaurants: restaurantsCount?.count ?? 0,
    pendingRestaurants: pendingCount?.count ?? 0,
  };
}

export async function getAllUsers(limit: number = 100, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
}

export async function getPublishedRestaurants(limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(restaurants)
    .where(eq(restaurants.status, 'published'))
    .orderBy(desc(restaurants.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getAdminUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users)
    .where(sql`${users.role} IN ('admin', 'super_admin')`)
    .orderBy(desc(users.createdAt));
}

export async function setUserRole(userId: number, role: 'user' | 'admin' | 'super_admin') {
  const db = await getDb();
  if (!db) return null;
  await db.update(users).set({ role }).where(eq(users.id, userId));
  const [updated] = await db.select().from(users).where(eq(users.id, userId));
  return updated;
}

/**
 * 按经纬度查询附近已发布餐厅（Haversine 公式，单位：公里）
 */
export async function getNearbyRestaurants(lat: number, lng: number, radiusKm: number = 5, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  // Haversine 公式（MySQL 内联计算距离）
  const distanceExpr = sql<number>`
    6371 * 2 * ASIN(SQRT(
      POWER(SIN((RADIANS(CAST(${restaurants.latitude} AS DECIMAL(10,7))) - RADIANS(${lat})) / 2), 2) +
      COS(RADIANS(${lat})) * COS(RADIANS(CAST(${restaurants.latitude} AS DECIMAL(10,7)))) *
      POWER(SIN((RADIANS(CAST(${restaurants.longitude} AS DECIMAL(10,7))) - RADIANS(${lng})) / 2), 2)
    ))
  `;
  const result = await db.select({
    id: restaurants.id,
    name: restaurants.name,
    cuisine: restaurants.cuisine,
    address: restaurants.address,
    city: restaurants.city,
    district: restaurants.district,
    averageRating: restaurants.averageRating,
    priceLevel: restaurants.priceLevel,
    latitude: restaurants.latitude,
    longitude: restaurants.longitude,
    distance: distanceExpr,
  })
    .from(restaurants)
    .where(
      sql`${restaurants.status} = 'published'
        AND ${restaurants.latitude} IS NOT NULL
        AND ${restaurants.longitude} IS NOT NULL
        AND (6371 * 2 * ASIN(SQRT(
          POWER(SIN((RADIANS(CAST(${restaurants.latitude} AS DECIMAL(10,7))) - RADIANS(${lat})) / 2), 2) +
          COS(RADIANS(${lat})) * COS(RADIANS(CAST(${restaurants.latitude} AS DECIMAL(10,7)))) *
          POWER(SIN((RADIANS(CAST(${restaurants.longitude} AS DECIMAL(10,7))) - RADIANS(${lng})) / 2), 2)
        ))) <= ${radiusKm}`
    )
    .orderBy(distanceExpr)
    .limit(limit);
  return result;
}
