import { PUBLIC_CACHE_CONTROL } from "@albbas/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db/prisma.js";
import {
  getUploadCache,
  setUploadCache,
  type UploadCacheEntry,
} from "../lib/cache.js";
import { storage } from "../storage/instance.js";

function parseSlug(raw: string): string | null {
  const match = raw.match(/^([A-Za-z0-9]{9})(?:\.[A-Za-z0-9]+)?$/);
  return match?.[1] ?? null;
}

const INLINE_PREFIXES = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "text/plain",
];

function sanitizeHeaderFilename(name: string): string {
  return Array.from(name, (char) => {
    const code = char.charCodeAt(0);
    return code < 32 || '"\\'.includes(char) ? "_" : char;
  }).join("");
}

async function resolveUpload(slug: string): Promise<UploadCacheEntry | null> {
  const cached = await getUploadCache(slug);
  if (cached) {
    void prisma.upload
      .updateMany({ where: { slug }, data: { visits: { increment: 1 } } })
      .catch(() => undefined);
    return cached;
  }

  const upload = await prisma.upload.findUnique({ where: { slug } });
  if (!upload) return null;

  const entry = {
    s3Key: upload.s3Key,
    mimeType: upload.mimeType,
    originalName: upload.originalName,
    sizeBytes: upload.sizeBytes,
  };
  void setUploadCache(slug, entry);
  return entry;
}

async function serveFile(
  request: FastifyRequest<{
    Params: { slug: string };
    Querystring: { dl?: string };
  }>,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  const rawSlug = request.params.slug;
  const slug = parseSlug(rawSlug);
  if (!slug) return reply.code(404).type("text/plain").send("404: not found");

  const upload = await resolveUpload(slug);
  if (!upload) return reply.code(404).type("text/plain").send("404: not found");

  const download = request.query.dl === "1";
  const isInline =
    !download &&
    INLINE_PREFIXES.some((prefix) => upload.mimeType.startsWith(prefix));
  const disposition = isInline
    ? "inline"
    : `attachment; filename="${sanitizeHeaderFilename(upload.originalName)}"`;

  reply
    .type(upload.mimeType)
    .header("content-length", String(upload.sizeBytes))
    .header("content-disposition", disposition)
    .header("cache-control", PUBLIC_CACHE_CONTROL)
    .header("x-content-type-options", "nosniff");

  try {
    const object = await storage.get(upload.s3Key);
    object.stream.on("error", (err) => {
      request.log.warn({ err, slug }, "Streaming object from storage failed");
      if (!reply.sent) {
        void reply.code(502).type("text/plain").send("502: upstream error");
      } else {
        reply.raw.destroy(err);
      }
    });
    return reply.send(object.stream);
  } catch (err) {
    request.log.warn({ err, slug }, "Failed to open object from storage");
    return reply.code(502).type("text/plain").send("502: upstream error");
  }
}

export function registerFileRoutes(app: FastifyInstance): void {
  app.get("/f/:slug", serveFile);
  app.get("/:slug", serveFile);
}
