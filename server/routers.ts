import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

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
        images: z.string().optional(),
        restaurantId: z.number().optional(),
        rating: z.number().min(1).max(5).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createPost({
          userId: ctx.user.id,
          title: input.title,
          content: input.content,
          images: input.images,
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
});

export type AppRouter = typeof appRouter;
