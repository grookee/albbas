import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { delPastePageCache } from '../lib/cache.js';
import { storage } from '../storage/instance.js';
import { router, protectedProcedure } from '../trpc.js';

const listSchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const pastesRouter = router({
  list: protectedProcedure.input(listSchema).query(async ({ ctx, input }) => {
    const rows = await prisma.paste.findMany({
      where: {
        userId: ctx.user.id,
        ...(input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: input.limit,
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        language: row.language,
        filename: row.filename,
        sizeBytes: row.sizeBytes,
        url: `${row.baseUrl}/${row.slug}`,
        visits: row.visits,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor:
        rows.length === input.limit ? (rows.at(-1)?.createdAt.toISOString() ?? null) : null,
    };
  }),

  delete: protectedProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const paste = await prisma.paste.findUnique({
        where: { slug: input.slug },
      });
      if (!paste) throw new TRPCError({ code: 'NOT_FOUND', message: 'Paste not found' });
      if (paste.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not yours' });
      }

      await storage.delete(paste.s3Key).catch(() => undefined);
      await prisma.paste.delete({ where: { id: paste.id } });
      await delPastePageCache(paste.slug);
      return { ok: true };
    }),
});
