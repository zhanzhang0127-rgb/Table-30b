import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // Validate email domain - must be an XJTLU address
      // Exceptions:
      //   1. Admin whitelist emails are always allowed (initial bootstrap accounts)
      //   2. Existing admin/super_admin users bypass the domain check on subsequent logins
      const ALLOWED_EMAIL_SUFFIXES = ["@xjtlu.edu.cn", "@student.xjtlu.edu.cn"];
      const ADMIN_EMAIL_WHITELIST = ["zhanzhang0127@gmail.com"];

      const existingUser = await db.getUserByOpenId(userInfo.openId);
      const isExistingAdmin = existingUser?.role === "admin" || existingUser?.role === "super_admin";
      const isWhitelisted = userInfo.email ? ADMIN_EMAIL_WHITELIST.includes(userInfo.email) : false;
      const hasAllowedSuffix = userInfo.email
        ? ALLOWED_EMAIL_SUFFIXES.some(suffix => userInfo.email!.endsWith(suffix))
        : false;

      if (userInfo.email && !isExistingAdmin && !isWhitelisted && !hasAllowedSuffix) {
        res.redirect(302, "/?error=invalid_email_domain");
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/?success=true");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.redirect(302, "/?error=oauth_failed");
    }
  });

  // Dev-only login backdoor: bypasses Manus OAuth so local pages can be rendered
  // without going through the verification-code flow. Disabled in production.
  if (process.env.NODE_ENV !== "production") {
    app.get("/api/dev-login", async (req: Request, res: Response) => {
      const openId = getQueryParam(req, "openId") ?? ENV.ownerOpenId;

      if (!openId) {
        res.status(400).send("dev-login requires OWNER_OPEN_ID in .env or ?openId= query param");
        return;
      }

      try {
        const existing = await db.getUserByOpenId(openId);
        const name = existing?.name ?? process.env.OWNER_NAME ?? "Dev User";

        await db.upsertUser({
          openId,
          name,
          email: existing?.email ?? null,
          loginMethod: existing?.loginMethod ?? "dev",
          lastSignedIn: new Date(),
        });

        const sessionToken = await sdk.createSessionToken(openId, {
          name,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        console.log(`[DevLogin] Issued session for openId=${openId} (${name})`);
        res.redirect(302, "/?success=dev_login");
      } catch (error) {
        console.error("[DevLogin] Failed", error);
        res.status(500).send("dev-login failed: " + String(error));
      }
    });

    console.log("[DevLogin] Enabled at /api/dev-login (NODE_ENV != production)");
  }
}
