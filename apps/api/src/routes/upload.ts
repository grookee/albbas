import { generateSlug, PASTE_SLUG_LENGTH, SHORT_SLUG_LENGTH } from '@albbas/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';
import { authenticateRequest } from '../auth.js';
import { prisma } from '../db/prisma.js';
import { env } from '../env.js';
import { delPastePageCache, delUploadCache, setUploadCache } from '../lib/cache.js';
import { baseUrlForUser } from '../lib/domain.js';
import { autoOrientImage } from '../lib/image.js';
import { extensionForMimeType } from '../lib/mime.js';
import {
  detectPasteLanguage,
  isKnownPasteLanguage,
  isTextUpload,
  validateTargetUrl,
} from '../lib/paste.js';
import { isRateLimited } from '../lib/rateLimit.js';
import { storage } from '../storage/instance.js';

const SLUG_PATTERN = /^[A-Za-z0-9]{6,9}$/;

function sanitizeFilename(filename: string): string {
  const basename = filename.split(/[\\/]/).pop() ?? '';
  return Array.from(basename, (char) => {
    const code = char.charCodeAt(0);
    return code < 32 || '"<>|:*?'.includes(char) ? '_' : char;
  })
    .join('')
    .slice(0, 255);
}

async function generateUniqueSlug(
  length: number,
  model: {
    findUnique: (args: {
      where: { slug: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  },
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug(length);
    const existing = await model.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  throw new Error('Failed to allocate a unique slug');
}

function rateLimitKey(key: { id: string } | null, user: { id: string }): string {
  return key ? `key:${key.id}` : `user:${user.id}`;
}

type Auth = { user: { id: string }; key: { id: string } | null };

async function handleFileUpload(
  reply: FastifyReply,
  auth: Auth,
  baseUrl: string,
  options: { filename: string; mimeType: string; buffer: Buffer },
): Promise<FastifyReply> {
  const { filename, mimeType, buffer } = options;

  const limited = await isRateLimited(
    'upload',
    rateLimitKey(auth.key, auth.user),
    env.UPLOAD_RATE_LIMIT_PER_HOUR,
    3600,
  );
  if (limited) {
    return reply.code(429).send({ error: 'Upload rate limit exceeded, try again later' });
  }

  const body = await autoOrientImage(buffer, mimeType);
  const slug = await generateUniqueSlug(9, prisma.upload);
  const s3Key = `uploads/${slug}`;

  try {
    await storage.put(s3Key, {
      stream: Readable.from(body),
      contentType: mimeType,
    });
  } catch (err) {
    await storage.delete(s3Key).catch(() => undefined);
    throw err;
  }

  await prisma.upload.create({
    data: {
      slug,
      userId: auth.user.id,
      originalName: filename,
      mimeType,
      sizeBytes: body.length,
      s3Key,
      baseUrl,
    },
  });
  await setUploadCache(slug, {
    s3Key,
    mimeType,
    originalName: filename,
    sizeBytes: body.length,
  });

  const url = `${baseUrl}/${slug}${extensionForMimeType(mimeType)}`;
  const deleteUrl = `${baseUrl}/api/upload/${slug}`;
  return reply.code(201).send({ url, deleteUrl });
}

async function handlePaste(
  reply: FastifyReply,
  auth: Auth,
  baseUrl: string,
  options: {
    filename: string;
    mimeType: string;
    buffer: Buffer;
    fields: Record<string, string>;
  },
): Promise<FastifyReply> {
  const { filename, mimeType, buffer, fields } = options;

  const limited = await isRateLimited(
    'paste',
    rateLimitKey(auth.key, auth.user),
    env.UPLOAD_RATE_LIMIT_PER_HOUR,
    3600,
  );
  if (limited) {
    return reply.code(429).send({ error: 'Upload rate limit exceeded, try again later' });
  }

  if (buffer.length > env.PASTE_MAX_BYTES) {
    return reply.code(413).send({ error: `Text exceeds the ${env.PASTE_MAX_BYTES} byte limit` });
  }

  const requested = fields['language'];
  const language =
    requested && isKnownPasteLanguage(requested)
      ? requested
      : detectPasteLanguage(filename, mimeType);
  const title = (fields['title'] ?? '').trim().slice(0, 200) || null;

  const slug = await generateUniqueSlug(PASTE_SLUG_LENGTH, prisma.paste);
  const s3Key = `pastes/${slug}`;

  try {
    await storage.put(s3Key, {
      stream: Readable.from(buffer),
      contentType: 'text/plain; charset=utf-8',
    });
  } catch (err) {
    await storage.delete(s3Key).catch(() => undefined);
    throw err;
  }

  await prisma.paste.create({
    data: {
      slug,
      userId: auth.user.id,
      title,
      language,
      filename,
      s3Key,
      sizeBytes: buffer.length,
      baseUrl,
    },
  });

  const url = `${baseUrl}/${slug}`;
  const deleteUrl = `${baseUrl}/api/upload/${slug}`;
  return reply.code(201).send({ url, deleteUrl });
}

async function handleShorten(
  reply: FastifyReply,
  auth: Auth,
  baseUrl: string,
  rawUrl: string,
): Promise<FastifyReply> {
  const limited = await isRateLimited(
    'shorten',
    rateLimitKey(auth.key, auth.user),
    env.UPLOAD_RATE_LIMIT_PER_HOUR,
    3600,
  );
  if (limited) {
    return reply.code(429).send({ error: 'Upload rate limit exceeded, try again later' });
  }

  const targetUrl = validateTargetUrl(rawUrl);
  if (!targetUrl) {
    return reply.code(400).send({ error: 'Invalid URL' });
  }

  const slug = await generateUniqueSlug(SHORT_SLUG_LENGTH, prisma.shortUrl);
  await prisma.shortUrl.create({
    data: { slug, userId: auth.user.id, targetUrl, baseUrl },
  });

  const url = `${baseUrl}/${slug}`;
  const deleteUrl = `${baseUrl}/api/upload/${slug}`;
  return reply.code(201).send({ url, deleteUrl });
}

async function handleUpload(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const baseUrl = baseUrlForUser(auth.user);
  if (!baseUrl) {
    return reply.code(400).send({ error: 'Set a domain and subdomain in settings first' });
  }

  let file: { filename: string; mimeType: string; buffer: Buffer } | null = null;
  const fields: Record<string, string> = {};

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      file = {
        filename: sanitizeFilename(part.filename) || 'file',
        mimeType: part.mimetype || 'application/octet-stream',
        buffer: await part.toBuffer(),
      };
    } else {
      fields[part.fieldname] = String(part.value);
    }
  }

  if (file) {
    if (file.buffer.length > env.MAX_UPLOAD_BYTES) {
      return reply.code(413).send({ error: `File exceeds the ${env.MAX_UPLOAD_BYTES} byte limit` });
    }
    if (isTextUpload(file.filename, file.mimeType)) {
      return handlePaste(reply, auth, baseUrl, { ...file, fields });
    }
    return handleFileUpload(reply, auth, baseUrl, file);
  }

  const rawUrl = fields['url'];
  if (rawUrl) {
    return handleShorten(reply, auth, baseUrl, rawUrl);
  }

  return reply.code(400).send({ error: 'No file part in request (expected field name "file")' });
}

async function handleDelete(
  request: FastifyRequest<{ Params: { slug: string } }>,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  const auth = await authenticateRequest(request);
  if (!auth) return reply.code(401).send({ error: 'Unauthorized' });

  const { slug } = request.params;
  if (!SLUG_PATTERN.test(slug)) return reply.code(404).send({ error: 'Not found' });

  if (slug.length === SHORT_SLUG_LENGTH) {
    const shortUrl = await prisma.shortUrl.findUnique({ where: { slug } });
    if (!shortUrl) return reply.code(404).send({ error: 'Not found' });
    if (shortUrl.userId !== auth.user.id) return reply.code(403).send({ error: 'Forbidden' });

    await prisma.shortUrl.delete({ where: { id: shortUrl.id } });
    return reply.code(200).send({ ok: true });
  }

  if (slug.length === PASTE_SLUG_LENGTH) {
    const paste = await prisma.paste.findUnique({ where: { slug } });
    if (!paste) return reply.code(404).send({ error: 'Not found' });
    if (paste.userId !== auth.user.id) return reply.code(403).send({ error: 'Forbidden' });

    await storage.delete(paste.s3Key).catch(() => undefined);
    await prisma.paste.delete({ where: { id: paste.id } });
    await delPastePageCache(paste.slug);
    return reply.code(200).send({ ok: true });
  }

  const upload = await prisma.upload.findUnique({ where: { slug } });
  if (!upload) return reply.code(404).send({ error: 'Not found' });
  if (upload.userId !== auth.user.id) return reply.code(403).send({ error: 'Forbidden' });

  await storage.delete(upload.s3Key).catch(() => undefined);
  await prisma.upload.delete({ where: { id: upload.id } });
  await delUploadCache(upload.slug);
  return reply.code(200).send({ ok: true });
}

export function registerUploadRoutes(app: FastifyInstance): void {
  app.post('/api/upload', handleUpload);
  app.delete('/api/upload/:slug', handleDelete);
}
