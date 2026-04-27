import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";
import { invokeGLM4, type GLM4Message } from "./_core/glm4";
// Using native fetch (Node 18+)

// Admin procedure: allows both admin and super_admin
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'super_admin')
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要管理员权限' });
  return next({ ctx });
});

// Super admin procedure: only super_admin
const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'super_admin')
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要超级管理员权限' });
  return next({ ctx });
});

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

    // 获取已发布餐厅列表（公开）
    getPublished: publicProcedure
      .input(z.object({
        limit: z.number().default(20),
        offset: z.number().default(0),
      }))
      .query(({ input }) => db.getPublishedRestaurants(input.limit, input.offset)),

    // 逆地理编码：坐标 → 中文地址（后端代理，Key 不暴露给前端）
    reverseGeocode: protectedProcedure
      .input(z.object({
        latitude: z.number(),
        longitude: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { latitude, longitude } = input;
        const key = ENV.amapApiKey;
        if (!key) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '地图服务未配置' });
        const url = `https://restapi.amap.com/v3/geocode/regeo?key=${key}&location=${longitude},${latitude}&radius=100&extensions=base&batch=false`;
        const res = await fetch(url);
        const data = await res.json() as any;
        if (data.status !== '1') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '地址解析失败' });
        const regeocode = data.regeocode;
        return {
          address: regeocode.formatted_address as string,
          city: (regeocode.addressComponent?.city || regeocode.addressComponent?.province || '') as string,
          district: (regeocode.addressComponent?.district || '') as string,
        };
      }),

    // 用户提交餐厅（默认 pending 待审核）
    submit: protectedProcedure
      .input(z.object({
        name: z.string().min(1, '请输入餐厅名称'),
        description: z.string().optional(),
        cuisine: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        phone: z.string().optional(),
        image: z.string().optional(),
        priceLevel: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        let imageUrl = input.image;
        if (imageUrl && imageUrl.startsWith('data:')) {
          const parts = imageUrl.split(',');
          const base64Data = parts[1];
          if (base64Data) {
            const buffer = Buffer.from(base64Data, 'base64');
            const fileKey = `restaurants/user-${ctx.user.id}-${Date.now()}.jpg`;
            const { url } = await storagePut(fileKey, buffer, 'image/jpeg');
            imageUrl = url;
          }
        }
        return db.createRestaurantAdmin({
          ...input,
          image: imageUrl,
          status: 'pending',
          submittedBy: ctx.user.id,
        });
      }),
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

  // Admin router
  admin: router({
    // 数据概览
    getStats: adminProcedure
      .query(() => db.getAdminStats()),

    // 用户管理（仅 super_admin）
    getUsers: superAdminProcedure
      .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }))
      .query(({ input }) => db.getAllUsers(input.limit, input.offset)),

    // 管理员管理（仅 super_admin）
    getAdmins: superAdminProcedure
      .query(() => db.getAdminUsers()),

    setUserRole: superAdminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['user', 'admin', 'super_admin']),
      }))
      .mutation(async ({ ctx, input }) => {
        // 防止修改自己的角色
        if (input.userId === ctx.user.id)
          throw new TRPCError({ code: 'BAD_REQUEST', message: '不能修改自己的角色' });
        return db.setUserRole(input.userId, input.role);
      }),

    // 餐厅管理
    getRestaurants: adminProcedure
      .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }))
      .query(({ input }) => db.getAllRestaurantsAdmin(input.limit, input.offset)),

    createRestaurant: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        cuisine: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        phone: z.string().optional(),
        image: z.string().optional(),
        priceLevel: z.string().optional(),
        status: z.enum(['published', 'pending', 'rejected']).default('published'),
      }))
      .mutation(async ({ ctx, input }) => {
        // Handle base64 image upload
        let imageUrl = input.image;
        if (imageUrl && imageUrl.startsWith('data:')) {
          const parts = imageUrl.split(',');
          const base64Data = parts[1];
          if (base64Data) {
            const buffer = Buffer.from(base64Data, 'base64');
            const key = `restaurants/${Date.now()}.jpg`;
            const { url } = await storagePut(key, buffer, 'image/jpeg');
            imageUrl = url;
          }
        }
        return db.createRestaurantAdmin({ ...input, image: imageUrl, status: input.status });
      }),

    updateRestaurant: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        cuisine: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        phone: z.string().optional(),
        image: z.string().optional(),
        priceLevel: z.string().optional(),
        status: z.enum(['published', 'pending', 'rejected']).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        // Handle base64 image upload
        if (data.image && data.image.startsWith('data:')) {
          const parts = data.image.split(',');
          const base64Data = parts[1];
          if (base64Data) {
            const buffer = Buffer.from(base64Data, 'base64');
            const key = `restaurants/${Date.now()}.jpg`;
            const { url } = await storagePut(key, buffer, 'image/jpeg');
            data.image = url;
          }
        }
        return db.updateRestaurant(id, data);
      }),

    deleteRestaurant: adminProcedure
      .input(z.number())
      .mutation(({ input }) => db.deleteRestaurant(input)),

    updateRestaurantStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['published', 'pending', 'rejected']),
      }))
      .mutation(({ input }) => db.updateRestaurantStatus(input.id, input.status)),
  }),

  aiRecommendations: router({
    // 真实 GLM-4 AI 对话接口
    chat: protectedProcedure
      .input(z.object({
        message: z.string().min(1).max(500),
        conversationHistory: z.array(z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string(),
        })).default([]),
        // 用户实时位置（可选）
        userLocation: z.object({
          latitude: z.number(),
          longitude: z.number(),
          address: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;

        // 从数据库获取用户行为上下文 + 附近餐厅（如果有位置）
        const [likedPosts, favRestaurants, recentPosts, nearbyRestaurants] = await Promise.all([
          db.getMyLikedPostsWithDetails(user.id, 5),
          db.getUserFavorites(user.id),
          db.getPostsForFeed(8, 0),
          input.userLocation
            ? db.getNearbyRestaurants(input.userLocation.latitude, input.userLocation.longitude, 5, 8)
            : Promise.resolve([]),
        ]);

        const favNames = (favRestaurants as any[]).slice(0, 5).map((r: any) => r.name).join('、') || '暂无';
        const likedTitles = (likedPosts as any[]).slice(0, 5).map((p: any) => p.title).join('、') || '暂无';
        const hotPosts = (recentPosts as any[]).slice(0, 5).map((p: any) => `《${p.title}》(${p.rating}星)`).join('、') || '暂无';

        // 构建附近餐厅信息
        const nearbyInfo = (nearbyRestaurants as any[]).length > 0
          ? (nearbyRestaurants as any[]).map((r: any) => {
              const dist = typeof r.distance === 'number' ? r.distance.toFixed(1) : '?';
              return `${r.name}（${dist}km，${r.cuisine || '综合'}，${r.priceLevel || '未知价位'}，评分${r.averageRating || '暂无'}）`;
            }).join('；')
          : null;

        const locationLine = input.userLocation?.address
          ? `- 当前位置：${input.userLocation.address}`
          : input.userLocation
          ? `- 当前位置：经纬度 (${input.userLocation.latitude.toFixed(4)}, ${input.userLocation.longitude.toFixed(4)})`
          : '';

        const nearbyLine = nearbyInfo
          ? `- 附近5km内餐厅：${nearbyInfo}`
          : '';

        const systemPrompt = `你是「吃了吗」美食社交平台的 AI 助手，专门帮助用户发现好餐厅、分享美食体验。

当前用户信息：
- 用户名：${user.name || '匿名用户'}
- 收藏的餐厅：${favNames}
- 最近点赞的帖子：${likedTitles}
${locationLine}
${nearbyLine}

平台近期热门内容：${hotPosts}

你的职责：
1. 根据用户口味偏好和收藏历史给出个性化餐厅推荐
2. 如果用户提供了位置，优先推荐附近餐厅列表中的餐厅
3. 回答关于美食、餐厅、菜系的问题
4. 帮助用户分析饮食偏好

回复要求：
- 用中文回复，语气友好自然
- 推荐附近餐厅时说明距离和推荐理由
- 回复简洁，不超过350字
- 非美食相关问题礼貌引导回美食话题`;

        const messages: GLM4Message[] = [
          { role: 'system', content: systemPrompt },
          ...input.conversationHistory.slice(-6).map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user', content: input.message },
        ];

        const reply = await invokeGLM4(messages, { temperature: 0.8, maxTokens: 600 });

        // 保存对话记录
        await db.createAiRecommendation({
          userId: user.id,
          query: input.message,
          recommendations: reply,
          conversationHistory: JSON.stringify(input.conversationHistory),
        });

        return { reply };
      }),

    getMyRecommendations: protectedProcedure
      .input(z.object({
        limit: z.number().default(10),
      }))
      .query(({ ctx, input }) => db.getUserAiRecommendations(ctx.user.id, input.limit)),
  }),
});

export type AppRouter = typeof appRouter;
