import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getUserByOpenId, listUsers, updateUserRole } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const manageStaffProcedure = protectedProcedure.use(({ ctx, next }) => {
  const role = ctx.user.role;
  if (role !== "admin" && role !== "gerente") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Somente admin ou gerente podem administrar funções." });
  }
  return next();
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
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

  staff: router({
    list: manageStaffProcedure.query(() => listUsers()),
    setRole: manageStaffProcedure
      .input(z.object({ openId: z.string().min(1), role: z.enum(["user", "admin", "garcom", "caixa", "gerente"]) }))
      .mutation(async ({ input }) => {
        const updated = await updateUserRole(input.openId, input.role);
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
        return updated;
      }),
    me: protectedProcedure.query(({ ctx }) => getUserByOpenId(ctx.user.openId)),
  }),
});

export type AppRouter = typeof appRouter;
