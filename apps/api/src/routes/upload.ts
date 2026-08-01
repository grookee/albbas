import { generateSlug } from "@albbas/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { pipeline } from "node:stream/promises";
import { authenticateRequest } from "../auth.js";
import { prisma } from "../db/prisma.js";
import { env } from "../env.js";
import { delUploadCache, setUploadCache } from "../lib/cache.js";
import { baseUrlForUser } from "../lib/domain.js";
import { isRateLimited } from "../lib/rateLimit.js";
import { ByteCounter } from "../lib/streams.js";
import { storage } from "../storage/instance.js";

const SLUG_PATTERN = /^[A-Za-z0-9]{9}$/;

function sanitizeFilename(filename: string): string {
  const basename = filename.split(/[\\/]/).pop() ?? "";
  return Array.from(basename, (char) => {
    const code = char.charCodeAt(0);
    return code < 32 || '"<>|:*?'.includes(char) ? "_" : char;
  })
    .join("")
    .slice(0, 255);
}

async function generateUniqueSlug(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug();
    const existing = await prisma.upload.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  throw new Error("Failed to allocate a unique slug");
}

async function handleUpload(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const { user, key } = auth;

  const baseUrl = baseUrlForUser(user);
  if (!baseUrl) {
    return reply
      .code(400)
      .send({ error: "Set a domain and subdomain in settings first" });
  }

  const limited = await isRateLimited(
    "upload",
    key ? `key:${key.id}` : `user:${user.id}`,
    env.UPLOAD_RATE_LIMIT_PER_HOUR,
    3600,
  );
  if (limited) {
    return reply
      .code(429)
      .send({ error: "Upload rate limit exceeded, try again later" });
  }

  const file = await request.file();
  if (!file) {
    return reply
      .code(400)
      .send({ error: 'No file part in request (expected field name "file")' });
  }

  const originalName = sanitizeFilename(file.filename) || "file";
  const mimeType = file.mimetype || "application/octet-stream";

  const slug = await generateUniqueSlug();
  const s3Key = `uploads/${slug}`;

  const counter = new ByteCounter();
  const putPromise = storage.put(s3Key, {
    stream: counter,
    contentType: mimeType,
  });

  try {
    await pipeline(file.file, counter);
  } catch (err) {
    await putPromise.catch(() => undefined);
    await storage.delete(s3Key).catch(() => undefined);
    throw err;
  }
  await putPromise;

  const sizeBytes = counter.bytes;
  if (sizeBytes > env.MAX_UPLOAD_BYTES) {
    await storage.delete(s3Key).catch(() => undefined);
    return reply
      .code(413)
      .send({ error: `File exceeds the ${env.MAX_UPLOAD_BYTES} byte limit` });
  }

  await prisma.upload.create({
    data: {
      slug,
      userId: user.id,
      originalName,
      mimeType,
      sizeBytes,
      s3Key,
      baseUrl,
    },
  });
  await setUploadCache(slug, { s3Key, mimeType, originalName, sizeBytes });

  const url = `${baseUrl}/${slug}`;
  const deleteUrl = `${baseUrl}/api/upload/${slug}`;
  return reply.code(201).send({ url, deleteUrl });
}

async function handleDelete(
  request: FastifyRequest<{ Params: { slug: string } }>,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  const auth = await authenticateRequest(request);
  if (!auth) return reply.code(401).send({ error: "Unauthorized" });

  const { slug } = request.params;
  if (!SLUG_PATTERN.test(slug))
    return reply.code(404).send({ error: "Not found" });

  const upload = await prisma.upload.findUnique({ where: { slug } });
  if (!upload) return reply.code(404).send({ error: "Not found" });
  if (upload.userId !== auth.user.id)
    return reply.code(403).send({ error: "Forbidden" });

  await storage.delete(upload.s3Key).catch(() => undefined);
  await prisma.upload.delete({ where: { id: upload.id } });
  await delUploadCache(upload.slug);
  return reply.code(200).send({ ok: true });
}

export function registerUploadRoutes(app: FastifyInstance): void {
  app.post("/api/upload", handleUpload);
  app.delete("/api/upload/:slug", handleDelete);
}
