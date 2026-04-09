import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, posts, restaurants, comments, userProfiles, favorites, aiRecommendations, rankings } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

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
      values.role = 'admin';
      updateSet.role = 'admin';
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
  return db.insert(posts).values(post);
}

export async function getPostsByUserId(userId: number, limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(posts).where(eq(posts.userId, userId)).orderBy(desc(posts.createdAt)).limit(limit).offset(offset);
}

export async function getPostsForFeed(limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(posts).orderBy(desc(posts.createdAt)).limit(limit).offset(offset);
}

export async function getPostById(postId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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

// User Profile queries
export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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
  return db.insert(comments).values(comment);
}

export async function getCommentsByPostId(postId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(comments).where(eq(comments.postId, postId)).orderBy(desc(comments.createdAt));
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

// Rankings queries
export async function getRankingsByCity(city: string, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rankings).where(eq(rankings.city, city)).orderBy(rankings.rank).limit(limit);
}

export async function getRankingsByDistrict(city: string, district: string, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rankings).where(and(eq(rankings.city, city), eq(rankings.district, district))).orderBy(rankings.rank).limit(limit);
}
