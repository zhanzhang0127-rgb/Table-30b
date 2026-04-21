import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCtx(role: "user" | "admin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: role === "admin" ? 1 : 999,
    openId: role === "admin" ? "admin-open-id" : "user-open-id",
    email: role === "admin" ? "admin@example.com" : "user@example.com",
    name: role === "admin" ? "Admin User" : "Regular User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createUnauthCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("Admin Router - Permission Guard", () => {
  it("should reject unauthenticated users from getStats", async () => {
    const caller = appRouter.createCaller(createUnauthCtx());
    await expect(caller.admin.getStats()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("should reject regular users from getStats with FORBIDDEN", async () => {
    const caller = appRouter.createCaller(createCtx("user"));
    await expect(caller.admin.getStats()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("should reject regular users from getRestaurants with FORBIDDEN", async () => {
    const caller = appRouter.createCaller(createCtx("user"));
    await expect(caller.admin.getRestaurants({ limit: 10, offset: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("should reject regular users from getUsers with FORBIDDEN", async () => {
    const caller = appRouter.createCaller(createCtx("user"));
    await expect(caller.admin.getUsers({ limit: 10, offset: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("should reject regular users from createRestaurant with FORBIDDEN", async () => {
    const caller = appRouter.createCaller(createCtx("user"));
    await expect(
      caller.admin.createRestaurant({ name: "Test Restaurant", status: "published" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("should reject regular users from deleteRestaurant with FORBIDDEN", async () => {
    const caller = appRouter.createCaller(createCtx("user"));
    await expect(caller.admin.deleteRestaurant(1)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("should reject regular users from updateRestaurantStatus with FORBIDDEN", async () => {
    const caller = appRouter.createCaller(createCtx("user"));
    await expect(
      caller.admin.updateRestaurantStatus({ id: 1, status: "published" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admin user should be able to call getStats (returns data or throws DB error, not FORBIDDEN)", async () => {
    const caller = appRouter.createCaller(createCtx("admin"));
    // In test environment DB may not be available, but should NOT throw FORBIDDEN
    try {
      const result = await caller.admin.getStats();
      expect(result).toBeDefined();
    } catch (e: any) {
      // Should not be FORBIDDEN - any other error (like DB unavailable) is acceptable
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });

  it("admin user should be able to call getRestaurants (not FORBIDDEN)", async () => {
    const caller = appRouter.createCaller(createCtx("admin"));
    try {
      const result = await caller.admin.getRestaurants({ limit: 10, offset: 0 });
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });
});
