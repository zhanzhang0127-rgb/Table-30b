import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";

const LOCAL_PREVIEW_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const LOCAL_PREVIEW_OPEN_ID = "local-preview-user";

const isPrivateIpv4 = (host: string) => {
  const parts = host.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
};

const normalizeHost = (host: string | undefined): string => {
  if (!host) return "";
  const withoutPort = host.startsWith("[")
    ? host.slice(1, host.indexOf("]"))
    : host.split(":")[0];
  return withoutPort.toLowerCase();
};

export const isLocalPreviewRequest = (req: Request): boolean => {
  const host = normalizeHost(req.headers.host);
  return LOCAL_PREVIEW_HOSTS.has(host) || isPrivateIpv4(host);
};

export async function getLocalPreviewUser(): Promise<User> {
  const now = new Date();
  const existingUser = await db.getUserByOpenId(LOCAL_PREVIEW_OPEN_ID);

  if (existingUser) {
    await db.upsertUser({
      openId: LOCAL_PREVIEW_OPEN_ID,
      lastSignedIn: now,
    });
  } else {
    await db.upsertUser({
      openId: LOCAL_PREVIEW_OPEN_ID,
      name: "Local Preview",
      email: "local-preview@localhost",
      loginMethod: "local-preview",
      role: "super_admin",
      lastSignedIn: now,
    });
  }

  const user = await db.getUserByOpenId(LOCAL_PREVIEW_OPEN_ID);
  if (!user) {
    throw new Error("Local preview user could not be created");
  }

  return user;
}
