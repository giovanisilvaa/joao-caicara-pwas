import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "user" | "admin" | "garcom" | "caixa" | "gerente"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: `${role}-user`,
      email: `${role}@example.com`,
      name: role,
      loginMethod: "test",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("staff permissions", () => {
  it("blocks ordinary operational roles from listing users", async () => {
    const caller = appRouter.createCaller(contextFor("garcom"));
    await expect(caller.staff.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows a gerente to reach the staff procedure", async () => {
    const caller = appRouter.createCaller(contextFor("gerente"));
    await expect(caller.staff.list()).resolves.toEqual([]);
  });
});
