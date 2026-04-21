import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, posts, restaurants, comments, userProfiles, favorites, aiRecommendations, rankings, postLikes, commentLikes } from "../drizzle/schema";
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
  const result = await db.select({
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
  return result;
}

export async function getPostsForFeed(limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
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
  }).from(posts).leftJoin(users, eq(posts.userId, users.id)).orderBy(desc(posts.createdAt)).limit(limit).offset(offset);
  return result;
}

export async function getPostById(postId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({
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
  const result = await db.select({
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


// User name update
export async function updateUserName(userId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!name || name.trim().length === 0) throw new Error("Name cannot be empty");
  return db.update(users).set({ name: name.trim() }).where(eq(users.id, userId));
}
