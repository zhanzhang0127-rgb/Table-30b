import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { publicProcedure, router } from "./_core/trpc";

const ALLOWED_DOMAINS = ["@student.xjtlu.edu.cn", "@xjtlu.edu.cn"];

function isAllowedEmail(email: string) {
  return ALLOWED_DOMAINS.some(d => email.endsWith(d));
}

export const emailAuthRouter = router({
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8, "密码至少8位"),
        name: z.string().min(1, "请输入姓名").max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.trim().toLowerCase();

      if (!isAllowedEmail(email)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "只允许使用 @student.xjtlu.edu.cn 或 @xjtlu.edu.cn 邮箱注册",
        });
      }

      const existing = await db.getUserByEmail(email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "该邮箱已注册，请直接登录",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = await db.createUserWithPassword(email, passwordHash, input.name.trim());

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || email,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return { success: true, name: user.name };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.trim().toLowerCase();

      if (!isAllowedEmail(email)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "只允许使用 @student.xjtlu.edu.cn 或 @xjtlu.edu.cn 邮箱登录",
        });
      }

      const user = await db.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "邮箱或密码错误",
        });
      }

      const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
      if (!passwordMatch) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "邮箱或密码错误",
        });
      }

      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || email,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return { success: true, name: user.name };
    }),
});
