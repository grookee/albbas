import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createInviteSchema, generateInviteCode } from '@albbas/shared';
import { prisma } from '../db/prisma.js';
import { router, adminProcedure } from '../trpc.js';

function inviteStatus(invite: {
  usedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date | null;
}): 'valid' | 'used' | 'revoked' | 'expired' {
  if (invite.revokedAt) return 'revoked';
  if (invite.usedAt) return 'used';
  if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) return 'expired';
  return 'valid';
}

export const invitesRouter = router({
  create: adminProcedure.input(createInviteSchema).mutation(async ({ input, ctx }) => {
    const code = generateInviteCode();
    const invite = await prisma.inviteCode.create({
      data: {
        code,
        createdById: ctx.user.id,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
      select: { id: true, code: true, expiresAt: true, createdAt: true },
    });
    return {
      id: invite.id,
      code: invite.code,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      createdAt: invite.createdAt.toISOString(),
      status: 'valid' as const,
    };
  }),

  list: adminProcedure.query(async () => {
    const invites = await prisma.inviteCode.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return invites.map((invite) => ({
      id: invite.id,
      code: invite.code,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      createdAt: invite.createdAt.toISOString(),
      usedAt: invite.usedAt?.toISOString() ?? null,
      status: inviteStatus(invite),
    }));
  }),

  revoke: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const invite = await prisma.inviteCode.findUnique({ where: { id: input.id } });
      if (!invite) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invite code not found' });

      await prisma.inviteCode.update({ where: { id: invite.id }, data: { revokedAt: new Date() } });
      return { ok: true };
    }),
});
