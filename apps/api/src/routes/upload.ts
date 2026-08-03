import { generateSlug, PASTE_SLUG_LENGTH, SHORT_SLUG_LENGTH } from '@albbas/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';
import { authenticateRequest } from '../auth.js';
import { prisma } from '../db/prisma.js';
import { env } from '../env.js';
import { delPastePageCache, delUploadCache, setUploadCache } from '../lib/cache.js';
import { deletionSignature, verifyDeletionSignature } from '../lib/crypto.js';
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

function deletionUrlFor(baseUrl: string, slug: string): string {
  return `${baseUrl}/api/upload/${slug}?sig=${deletionSignature(slug, env.ENCRYPTION_KEY)}`;
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
  const deleteUrl = deletionUrlFor(baseUrl, slug);
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
  const deleteUrl = deletionUrlFor(baseUrl, slug);
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
  const deleteUrl = deletionUrlFor(baseUrl, slug);
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

  const query = request.query as Record<string, unknown>;
  const rawUrl = fields['url'] ?? (typeof query['url'] === 'string' ? query['url'] : null);
  if (rawUrl) {
    return handleShorten(reply, auth, baseUrl, rawUrl);
  }

  return reply.code(400).send({ error: 'No file part in request (expected field name "file")' });
}

async function findOwner(slug: string): Promise<string | null> {
  if (slug.length === SHORT_SLUG_LENGTH) {
    return (
      (await prisma.shortUrl.findUnique({ where: { slug }, select: { userId: true } }))?.userId ??
      null
    );
  }
  if (slug.length === PASTE_SLUG_LENGTH) {
    return (
      (await prisma.paste.findUnique({ where: { slug }, select: { userId: true } }))?.userId ?? null
    );
  }
  return (
    (await prisma.upload.findUnique({ where: { slug }, select: { userId: true } }))?.userId ?? null
  );
}

async function deleteEntity(slug: string): Promise<'short' | 'paste' | 'upload' | null> {
  if (slug.length === SHORT_SLUG_LENGTH) {
    const found = await prisma.shortUrl.findUnique({ where: { slug } });
    if (!found) return null;
    await prisma.shortUrl.delete({ where: { id: found.id } });
    return 'short';
  }

  if (slug.length === PASTE_SLUG_LENGTH) {
    const found = await prisma.paste.findUnique({ where: { slug } });
    if (!found) return null;
    await storage.delete(found.s3Key).catch(() => undefined);
    await prisma.paste.delete({ where: { id: found.id } });
    await delPastePageCache(found.slug);
    return 'paste';
  }

  const found = await prisma.upload.findUnique({ where: { slug } });
  if (!found) return null;
  await storage.delete(found.s3Key).catch(() => undefined);
  await prisma.upload.delete({ where: { id: found.id } });
  await delUploadCache(found.slug);
  return 'upload';
}

async function handleDelete(
  request: FastifyRequest<{ Params: { slug: string } }>,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  const auth = await authenticateRequest(request);
  if (!auth) return reply.code(401).send({ error: 'Unauthorized' });

  const { slug } = request.params;
  if (!SLUG_PATTERN.test(slug)) return reply.code(404).send({ error: 'Not found' });

  const owner = await findOwner(slug);
  if (!owner) return reply.code(404).send({ error: 'Not found' });
  if (owner !== auth.user.id) return reply.code(403).send({ error: 'Forbidden' });

  await deleteEntity(slug);
  return reply.code(200).send({ ok: true });
}

const DELETED_PAGE = (kind: 'short' | 'paste' | 'upload'): string => {
  const label = kind === 'short' ? 'short link' : kind;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>deleted — albbas</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#282828;color:#ebdbb2;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:center}h1{color:#fb4934;font-size:18px}p{color:#928374;font-size:14px}</style></head><body><div><h1>deleted</h1><p>the ${label} has been removed.</p></div></body></html>`;
};

async function handleBrowserDelete(
  request: FastifyRequest<{ Params: { slug: string } }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { slug } = request.params;
  const sig = (request.query as Record<string, unknown>)['sig'];

  if (!SLUG_PATTERN.test(slug) || typeof sig !== 'string' || sig.length === 0) {
    return reply.code(401).type('text/plain').send('401: unauthorized');
  }
  if (!verifyDeletionSignature(slug, sig, env.ENCRYPTION_KEY)) {
    return reply.code(401).type('text/plain').send('401: unauthorized');
  }

  const kind = await deleteEntity(slug);
  if (!kind) return reply.code(404).type('text/plain').send('404: not found');

  return reply
    .code(200)
    .type('text/html; charset=utf-8')
    .header('cache-control', 'no-store')
    .send(DELETED_PAGE(kind));
}

export function registerUploadRoutes(app: FastifyInstance): void {
  app.post('/api/upload', handleUpload);
  app.delete('/api/upload/:slug', handleDelete);
  app.get('/api/upload/:slug', handleBrowserDelete);
}
