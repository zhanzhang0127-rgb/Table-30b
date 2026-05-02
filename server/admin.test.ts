import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCtx(role: "user" | "admin" | "super_admin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: role === "super_admin" ? 1 : role === "admin" ? 2 : 999,
    openId: role === "super_admin" ? "super-admin-open-id" : role === "admin" ? "admin-open-id" : "user-open-id",
    email: role === "super_admin" ? "superadmin@example.com" : role === "admin" ? "admin@example.com" : "user@example.com",
    name: role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin User" : "Regular User",
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

  it("should reject admin users from getUsers with FORBIDDEN (super_admin only)", async () => {
    const caller = appRouter.createCaller(createCtx("admin"));
    await expect(caller.admin.getUsers({ limit: 10, offset: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("should reject admin users from getAdmins with FORBIDDEN (super_admin only)", async () => {
    const caller = appRouter.createCaller(createCtx("admin"));
    await expect(caller.admin.getAdmins()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("should reject admin users from setUserRole with FORBIDDEN (super_admin only)", async () => {
    const caller = appRouter.createCaller(createCtx("admin"));
    await expect(caller.admin.setUserRole({ userId: 999, role: "admin" })).rejects.toMatchObject({ code: "FORBIDDEN" });
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

  it("admin user should be able to call getStats (not FORBIDDEN)", async () => {
    const caller = appRouter.createCaller(createCtx("admin"));
    try {
      const result = await caller.admin.getStats();
      expect(result).toBeDefined();
    } catch (e: any) {
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

  it("super_admin should be able to call getAdmins (not FORBIDDEN)", async () => {
    const caller = appRouter.createCaller(createCtx("super_admin"));
    try {
      const result = await caller.admin.getAdmins();
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });

  it("super_admin should NOT be able to change their own role", async () => {
    const caller = appRouter.createCaller(createCtx("super_admin"));
    // super_admin id is 1 in createCtx
    await expect(caller.admin.setUserRole({ userId: 1, role: "admin" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("Restaurants Router - Submit & ReverseGeocode", () => {
  const validRestaurantSubmission = {
    name: "Test Restaurant",
    address: "123 Test Street",
    priceLevel: "30-50 元/人",
    description: "A small restaurant worth reviewing.",
    rating: 4,
  };

  it("should reject unauthenticated users from reverseGeocode", async () => {
    const caller = appRouter.createCaller(createUnauthCtx());
    await expect(
      caller.restaurants.reverseGeocode({ latitude: 31.4798, longitude: 121.0956 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("should reject unauthenticated users from submit", async () => {
    const caller = appRouter.createCaller(createUnauthCtx());
    await expect(
      caller.restaurants.submit(validRestaurantSubmission)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("should reject submit with empty name", async () => {
    const caller = appRouter.createCaller(createCtx("user"));
    await expect(
      caller.restaurants.submit({ ...validRestaurantSubmission, name: "" })
    ).rejects.toBeDefined();
  });

  it("authenticated user can call submit (DB may be unavailable in test, but not UNAUTHORIZED)", async () => {
    const caller = appRouter.createCaller(createCtx("user"));
    try {
      const result = await caller.restaurants.submit({
        ...validRestaurantSubmission,
        name: "太仓小吃店",
      });
      // If DB is available, should return an object with id
      expect(result).toBeDefined();
    } catch (e: any) {
      // DB not available in test env is acceptable; UNAUTHORIZED is not
      expect(e.code).not.toBe("UNAUTHORIZED");
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("getPublished should be accessible without authentication", async () => {
    const caller = appRouter.createCaller(createUnauthCtx());
    try {
      const result = await caller.restaurants.getPublished({ limit: 10, offset: 0 });
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      // DB not available is acceptable; auth errors are not
      expect(e.code).not.toBe("UNAUTHORIZED");
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });
});
