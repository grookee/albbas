import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { API_KEY_PREFIX, createApiKeySchema, generateApiKey } from '@albbas/shared';
import { prisma } from '../db/prisma.js';
import { env } from '../env.js';
import { decryptSecret, encryptionKeyFromSecret, encryptSecret, sha256Hex } from '../lib/crypto.js';
import { router, protectedProcedure } from '../trpc.js';

export const keysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const keys = await prisma.apiKey.findMany({
      where: { userId: ctx.user.id, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
      createdAt: key.createdAt.toISOString(),
    }));
  }),

  create: protectedProcedure.input(createApiKeySchema).mutation(async ({ input, ctx }) => {
    const { raw, prefix } = generateApiKey();
    const fullKey = `${API_KEY_PREFIX}${raw}`;
    const encryptionKey = encryptionKeyFromSecret(env.ENCRYPTION_KEY);
    const key = await prisma.apiKey.create({
      data: {
        name: input.name,
        prefix,
        keyHash: sha256Hex(fullKey),
        keyEnc: encryptSecret(fullKey, encryptionKey),
        userId: ctx.user.id,
      },
      select: { id: true, name: true, createdAt: true },
    });
    return {
      id: key.id,
      name: key.name,
      createdAt: key.createdAt.toISOString(),
      prefix,
      key: fullKey,
    };
  }),

  reveal: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const key = await prisma.apiKey.findFirst({
        where: { id: input.id, userId: ctx.user.id, revokedAt: null },
        select: { id: true, name: true, keyEnc: true },
      });
      if (!key)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'API key not found',
        });
      if (!key.keyEnc)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'This key predates config downloads. Revoke it and create a new one to get its config.',
        });
      const encryptionKey = encryptionKeyFromSecret(env.ENCRYPTION_KEY);
      return {
        id: key.id,
        name: key.name,
        key: decryptSecret(key.keyEnc, encryptionKey),
      };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const key = await prisma.apiKey.findFirst({
        where: { id: input.id, userId: ctx.user.id },
      });
      if (!key)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'API key not found',
        });

      await prisma.apiKey.update({
        where: { id: key.id },
        data: { revokedAt: new Date() },
      });
      return { ok: true };
    }),
});
