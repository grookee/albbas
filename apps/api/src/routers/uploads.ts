import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { delUploadCache } from "../lib/cache.js";
import { storage } from "../storage/instance.js";
import { router, protectedProcedure } from "../trpc.js";

const uploadListSchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const uploadsRouter = router({
  list: protectedProcedure
    .input(uploadListSchema)
    .query(async ({ ctx, input }) => {
      const uploads = await prisma.upload.findMany({
        where: {
          userId: ctx.user.id,
          ...(input.cursor
            ? { createdAt: { lt: new Date(input.cursor) } }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });

      return {
        items: uploads.map((upload) => ({
          id: upload.id,
          slug: upload.slug,
          originalName: upload.originalName,
          mimeType: upload.mimeType,
          sizeBytes: upload.sizeBytes,
          url: `${upload.baseUrl}/${upload.slug}`,
          createdAt: upload.createdAt.toISOString(),
        })),
        nextCursor:
          uploads.length === input.limit
            ? (uploads.at(-1)?.createdAt.toISOString() ?? null)
            : null,
      };
    }),

  delete: protectedProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const upload = await prisma.upload.findUnique({
        where: { slug: input.slug },
      });
      if (!upload)
        throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
      if (upload.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your upload" });
      }

      await storage.delete(upload.s3Key).catch(() => undefined);
      await prisma.upload.delete({ where: { id: upload.id } });
      await delUploadCache(upload.slug);
      return { ok: true };
    }),
});
