import { TRPCError } from '@trpc/server';
import { SESSION_COOKIE_NAME, loginSchema, registerSchema } from '@albbas/shared';
import { prisma } from '../db/prisma.js';
import { toPublicUser } from '../lib/publicUser.js';
import { router, publicProcedure, protectedProcedure } from '../trpc.js';
import {
  clearSessionCookie,
  createSession,
  destroySession,
  hashPassword,
  parseCookies,
  setSessionCookie,
  verifyPassword,
} from '../auth.js';

export const authRouter = router({
  me: protectedProcedure.query(({ ctx }) => toPublicUser(ctx.user)),

  login: publicProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    }

    const token = await createSession(user.id);
    setSessionCookie(ctx.reply, token);
    return toPublicUser(user);
  }),

  register: publicProcedure.input(registerSchema).mutation(async ({ input, ctx }) => {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'An account with that email already exists',
      });
    }

    const invite = await prisma.inviteCode.findUnique({
      where: { code: input.inviteCode },
    });
    if (!invite || invite.usedAt || invite.revokedAt) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid invite code',
      });
    }
    if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invite code has expired',
      });
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: await hashPassword(input.password),
        },
      });
      await tx.inviteCode.update({
        where: { id: invite.id },
        data: { usedAt: new Date(), usedById: created.id },
      });
      return created;
    });

    const token = await createSession(user.id);
    setSessionCookie(ctx.reply, token);
    return toPublicUser(user);
  }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const token = parseCookies(ctx.request.headers.cookie)[SESSION_COOKIE_NAME];
    if (token) await destroySession(token);
    clearSessionCookie(ctx.reply);
    return { ok: true };
  }),
});
