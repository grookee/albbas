import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { router, protectedProcedure } from '../trpc.js';

const listSchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const shortUrlsRouter = router({
  list: protectedProcedure.input(listSchema).query(async ({ ctx, input }) => {
    const rows = await prisma.shortUrl.findMany({
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
        targetUrl: row.targetUrl,
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
      const shortUrl = await prisma.shortUrl.findUnique({
        where: { slug: input.slug },
      });
      if (!shortUrl)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Short URL not found',
        });
      if (shortUrl.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not yours' });
      }

      await prisma.shortUrl.delete({ where: { id: shortUrl.id } });
      return { ok: true };
    }),
});
