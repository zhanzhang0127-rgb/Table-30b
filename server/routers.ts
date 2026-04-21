import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { storagePut } from "./storage";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Posts router
  posts: router({
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        content: z.string(),
        images: z.array(z.string()).optional(),
        restaurantId: z.number().optional(),
        rating: z.number().min(1).max(5).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        let imageUrls: string[] = [];
        
        if (input.images && input.images.length > 0) {
          for (let i = 0; i < input.images.length; i++) {
            const imageData = input.images[i];
            if (imageData.startsWith('data:')) {
              try {
                const parts = imageData.split(',');
                const base64Data = parts[1];
                if (!base64Data) {
                  throw new TRPCError({ code: 'BAD_REQUEST', message: `Invalid image format at index ${i}` });
                }
                const buffer = Buffer.from(base64Data, 'base64');
                if (buffer.length > 10 * 1024 * 1024) {
                  throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: `Image ${i} exceeds 10MB limit` });
                }
                const key = `posts/${ctx.user.id}/${Date.now()}-${i}.jpg`;
                const { url } = await storagePut(key, buffer, 'image/jpeg');
                imageUrls.push(url);
              } catch (error) {
                if (error instanceof TRPCError) throw error;
                console.error('Image upload failed:', error);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to upload image ${i}` });
              }
            } else if (imageData.startsWith('http')) {
              imageUrls.push(imageData);
            }
          }
        }
        
        return db.createPost({
          userId: ctx.user.id,
          title: input.title,
          content: input.content,
          images: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
          restaurantId: input.restaurantId,
          rating: input.rating,
        });
      }),
    
    getFeed: publicProcedure
      .input(z.object({
        limit: z.number().default(20),
        offset: z.number().default(0),
      }))
      .query(({ input }) => db.getPostsForFeed(input.limit, input.offset)),
    
    getByUser: publicProcedure
      .input(z.object({
        userId: z.number(),
        limit: z.number().default(20),
        offset: z.number().default(0),
      }))
      .query(({ input }) => db.getPostsByUserId(input.userId, input.limit, input.offset)),
    
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => db.getPostById(input)),
    
    delete: protectedProcedure
      .input(z.number())
      .mutation(async ({ ctx, input }) => {
        const post = await db.getPostById(input);
        if (!post) throw new TRPCError({ code: 'NOT_FOUND' });
        if (post.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
        return db.deletePost(input);
      }),
  }),

  // Restaurants router
  restaurants: router({
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => db.getRestaurantById(input)),
    
    getByCity: publicProcedure
      .input(z.object({
        city: z.string(),
        limit: z.number().default(20),
        offset: z.number().default(0),
      }))
      .query(({ input }) => db.getRestaurantsByCity(input.city, input.limit, input.offset)),
    
    getByDistrict: publicProcedure
      .input(z.object({
        city: z.string(),
        district: z.string(),
        limit: z.number().default(20),
        offset: z.number().default(0),
      }))
      .query(({ input }) => db.getRestaurantsByDistrict(input.city, input.district, input.limit, input.offset)),
  }),

  // User Profile router
  profile: router({
    getMe: protectedProcedure
      .query(({ ctx }) => db.getUserProfile(ctx.user.id)),
    
    update: protectedProcedure
      .input(z.object({
        phone: z.string().optional(),
        wechatId: z.string().optional(),
        qqId: z.string().optional(),
        avatar: z.string().optional(),
        bio: z.string().optional(),
        location: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        preferences: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createOrUpdateUserProfile({
          userId: ctx.user.id,
          ...input,
        });
      }),
    
    updateName: protectedProcedure
      .input(z.string().min(1).max(50))
      .mutation(async ({ ctx, input }) => {
        return db.updateUserName(ctx.user.id, input);
      }),
  }),

  // Favorites router
  favorites: router({
    add: protectedProcedure
      .input(z.number())
      .mutation(({ ctx, input }) => db.addFavorite(ctx.user.id, input)),
    
    remove: protectedProcedure
      .input(z.number())
      .mutation(({ ctx, input }) => db.removeFavorite(ctx.user.id, input)),
    
    getMyFavorites: protectedProcedure
      .query(({ ctx }) => db.getUserFavorites(ctx.user.id)),
  }),

  // Comments router
  comments: router({
    create: protectedProcedure
      .input(z.object({
        postId: z.number(),
        content: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createComment({
          postId: input.postId,
          userId: ctx.user.id,
          content: input.content,
        });
      }),
    
    getByPostId: publicProcedure
      .input(z.object({
        postId: z.number(),
        limit: z.number().default(20),
        offset: z.number().default(0),
      }))
      .query(({ input }) => db.getCommentsByPostId(input.postId, input.limit, input.offset)),
    
    delete: protectedProcedure
      .input(z.number())
      .mutation(async ({ ctx, input }) => {
        // Check if comment exists and belongs to the user
        const comment = await db.getCommentById(input);
        if (!comment) throw new TRPCError({ code: 'NOT_FOUND' });
        if (comment.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
        return db.deleteComment(input);
      }),
    
    like: protectedProcedure
      .input(z.number())
      .mutation(async ({ ctx, input }) => {
        return db.likeComment(ctx.user.id, input);
      }),
    
    unlike: protectedProcedure
      .input(z.number())
      .mutation(async ({ ctx, input }) => {
        return db.unlikeComment(ctx.user.id, input);
      }),
  }),

  // Likes router
  likes: router({
    getMyLikedPosts: protectedProcedure
      .query(async ({ ctx }) => {
        return db.getMyLikedPosts(ctx.user.id);
      }),

    getMyLikedPostsWithDetails: protectedProcedure
      .query(async ({ ctx }) => {
        return db.getMyLikedPostsWithDetails(ctx.user.id);
      }),

    getMyLikedComments: protectedProcedure
      .query(async ({ ctx }) => {
        return db.getMyLikedComments(ctx.user.id);
      }),

    likePost: protectedProcedure
      .input(z.number())
      .mutation(async ({ ctx, input }) => {
        return db.likePost(ctx.user.id, input);
      }),
    
    unlikePost: protectedProcedure
      .input(z.number())
      .mutation(async ({ ctx, input }) => {
        return db.unlikePost(ctx.user.id, input);
      }),

    likeComment: protectedProcedure
      .input(z.number())
      .mutation(async ({ ctx, input }) => {
        return db.likeComment(ctx.user.id, input);
      }),
    
    unlikeComment: protectedProcedure
      .input(z.number())
      .mutation(async ({ ctx, input }) => {
        return db.unlikeComment(ctx.user.id, input);
      }),
  }),

  // Rankings router
  rankings: router({
    getByCity: publicProcedure
      .input(z.object({
        city: z.string(),
        limit: z.number().default(20),
      }))
      .query(({ input }) => db.getRankingsByCity(input.city, input.limit)),
    
    getByDistrict: publicProcedure
      .input(z.object({
        city: z.string(),
        district: z.string(),
        limit: z.number().default(20),
      }))
      .query(({ input }) => db.getRankingsByDistrict(input.city, input.district, input.limit)),
  }),

  aiRecommendations: router({
    create: protectedProcedure
      .input(z.object({
        query: z.string(),
        recommendations: z.string().optional(),
        conversationHistory: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createAiRecommendation({
          userId: ctx.user.id,
          query: input.query,
          recommendations: input.recommendations,
          conversationHistory: input.conversationHistory,
        });
      }),
    
    getMyRecommendations: protectedProcedure
      .input(z.object({
        limit: z.number().default(10),
      }))
      .query(({ ctx, input }) => db.getUserAiRecommendations(ctx.user.id, input.limit)),
  }),
});

export type AppRouter = typeof appRouter;
