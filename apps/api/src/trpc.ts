import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getUserFromRequest, type SafeUser } from './auth.js';

export interface Context {
  user: SafeUser | null;
  request: FastifyRequest;
  reply: FastifyReply;
}

export interface AuthedContext extends Context {
  user: SafeUser;
}

export async function createContext({ req, res }: CreateFastifyContextOptions): Promise<Context> {
  const user = await getUserFromRequest(req);
  return { user, request: req, reply: res };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not signed in' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admins only' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
