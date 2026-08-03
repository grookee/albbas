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

type Auth = { user: { id: string }; key: { id: string } | null };
type EntityKind = 'short' | 'paste' | 'upload';
type UploadPart = { filename: string; mimeType: string; buffer: Buffer };
type ParsedUploadRequest = { file: UploadPart | null; fields: Record<string, string> };
type ResolveBaseUrlResult =
  { ok: true; auth: Auth; baseUrl: string } | { ok: false; status: 401 | 400; error: string };

export function sanitizeFilename(filename: string): string {
  const basename = filename.split(/[\\/]/).pop() ?? '';
  return Array.from(basename, (char) => {
    const code = char.charCodeAt(0);
    return code < 32 || '"<>|:*?'.includes(char) ? '_' : char;
  })
    .join('')
    .slice(0, 255);
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export function getEntityKind(slug: string): EntityKind | null {
  if (!isValidSlug(slug)) return null;
  if (slug.length === SHORT_SLUG_LENGTH) return 'short';
  if (slug.length === PASTE_SLUG_LENGTH) return 'paste';
  return 'upload';
}

export function buildPasteMetadata(
  filename: string,
  mimeType: string,
  fields: Record<string, string>,
): { language: string; title: string | null } {
  const requested = fields['language'];
  const language =
    requested && isKnownPasteLanguage(requested)
      ? requested
      : detectPasteLanguage(filename, mimeType);
  const title = (fields['title'] ?? '').trim().slice(0, 200) || null;
  return { language, title };
}

export function pasteSizeError(sizeBytes: number): string | null {
  return sizeBytes > env.PASTE_MAX_BYTES
    ? `Text exceeds the ${env.PASTE_MAX_BYTES} byte limit`
    : null;
}

export function extractUrlField(
  fields: Record<string, string>,
  query: Record<string, unknown>,
): string | null {
  return fields['url'] ?? (typeof query['url'] === 'string' ? query['url'] : null);
}

export function isValidDeletionSignature(slug: string, sig: unknown): boolean {
  return (
    typeof sig === 'string' &&
    sig.length > 0 &&
    verifyDeletionSignature(slug, sig, env.ENCRYPTION_KEY)
  );
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

async function isRateLimitedForReply(
  reply: FastifyReply,
  scope: 'upload' | 'paste' | 'shorten',
  auth: Auth,
): Promise<boolean> {
  const limited = await isRateLimited(
    scope,
    rateLimitKey(auth.key, auth.user),
    env.UPLOAD_RATE_LIMIT_PER_HOUR,
    3600,
  );
  if (limited) {
    reply.code(429).send({ error: 'Upload rate limit exceeded, try again later' });
  }
  return limited;
}

async function storeBuffer(s3Key: string, buffer: Buffer, contentType: string): Promise<void> {
  try {
    await storage.put(s3Key, {
      stream: Readable.from(buffer),
      contentType,
    });
  } catch (err) {
    await storage.delete(s3Key).catch(() => undefined);
    throw err;
  }
}

async function authenticateAndResolveBaseUrl(
  request: FastifyRequest,
): Promise<ResolveBaseUrlResult> {
  const auth = await authenticateRequest(request);
  if (!auth) return { ok: false, status: 401, error: 'Unauthorized' };

  const baseUrl = baseUrlForUser(auth.user);
  if (!baseUrl) {
    return { ok: false, status: 400, error: 'Set a domain and subdomain in settings first' };
  }

  return { ok: true, auth, baseUrl };
}

async function parseMultipartRequest(request: FastifyRequest): Promise<ParsedUploadRequest> {
  let file: UploadPart | null = null;
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

  return { file, fields };
}

async function handleFileUpload(
  reply: FastifyReply,
  auth: Auth,
  baseUrl: string,
  options: UploadPart,
): Promise<FastifyReply> {
  const { filename, mimeType, buffer } = options;

  if (await isRateLimitedForReply(reply, 'upload', auth)) return reply;

  const body = await autoOrientImage(buffer, mimeType);
  const slug = await generateUniqueSlug(9, prisma.upload);
  const s3Key = `uploads/${slug}`;
  await storeBuffer(s3Key, body, mimeType);

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
  options: UploadPart & { fields: Record<string, string> },
): Promise<FastifyReply> {
  const { filename, mimeType, buffer, fields } = options;

  if (await isRateLimitedForReply(reply, 'paste', auth)) return reply;

  const sizeError = pasteSizeError(buffer.length);
  if (sizeError) return reply.code(413).send({ error: sizeError });

  const { language, title } = buildPasteMetadata(filename, mimeType, fields);

  const slug = await generateUniqueSlug(PASTE_SLUG_LENGTH, prisma.paste);
  const s3Key = `pastes/${slug}`;
  await storeBuffer(s3Key, buffer, 'text/plain; charset=utf-8');

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
  if (await isRateLimitedForReply(reply, 'shorten', auth)) return reply;

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
  const resolved = await authenticateAndResolveBaseUrl(request);
  if (!resolved.ok) return reply.code(resolved.status).send({ error: resolved.error });

  const { file, fields } = await parseMultipartRequest(request);

  if (file) {
    if (file.buffer.length > env.MAX_UPLOAD_BYTES) {
      return reply.code(413).send({ error: `File exceeds the ${env.MAX_UPLOAD_BYTES} byte limit` });
    }
    if (isTextUpload(file.filename, file.mimeType)) {
      return handlePaste(reply, resolved.auth, resolved.baseUrl, { ...file, fields });
    }
    return handleFileUpload(reply, resolved.auth, resolved.baseUrl, file);
  }

  const rawUrl = extractUrlField(fields, request.query as Record<string, unknown>);
  if (rawUrl) {
    return handleShorten(reply, resolved.auth, resolved.baseUrl, rawUrl);
  }

  return reply.code(400).send({ error: 'No file part in request (expected field name "file")' });
}

const ownerFinders: Record<EntityKind, (slug: string) => Promise<string | null>> = {
  short: async (slug) =>
    (await prisma.shortUrl.findUnique({ where: { slug }, select: { userId: true } }))?.userId ??
    null,
  paste: async (slug) =>
    (await prisma.paste.findUnique({ where: { slug }, select: { userId: true } }))?.userId ?? null,
  upload: async (slug) =>
    (await prisma.upload.findUnique({ where: { slug }, select: { userId: true } }))?.userId ?? null,
};

function findOwner(slug: string): Promise<string | null> {
  const kind = getEntityKind(slug);
  return kind ? ownerFinders[kind](slug) : Promise.resolve(null);
}

async function deleteShortUrl(slug: string): Promise<boolean> {
  const found = await prisma.shortUrl.findUnique({ where: { slug } });
  if (!found) return false;
  await prisma.shortUrl.delete({ where: { id: found.id } });
  return true;
}

async function deletePaste(slug: string): Promise<boolean> {
  const found = await prisma.paste.findUnique({ where: { slug } });
  if (!found) return false;
  await storage.delete(found.s3Key).catch(() => undefined);
  await prisma.paste.delete({ where: { id: found.id } });
  await delPastePageCache(found.slug);
  return true;
}

async function deleteUpload(slug: string): Promise<boolean> {
  const found = await prisma.upload.findUnique({ where: { slug } });
  if (!found) return false;
  await storage.delete(found.s3Key).catch(() => undefined);
  await prisma.upload.delete({ where: { id: found.id } });
  await delUploadCache(found.slug);
  return true;
}

const entityDeleters: Record<EntityKind, (slug: string) => Promise<boolean>> = {
  short: deleteShortUrl,
  paste: deletePaste,
  upload: deleteUpload,
};

export async function deleteEntity(slug: string): Promise<EntityKind | null> {
  const kind = getEntityKind(slug);
  if (!kind) return null;
  return (await entityDeleters[kind](slug)) ? kind : null;
}

async function handleDelete(
  request: FastifyRequest<{ Params: { slug: string } }>,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  const auth = await authenticateRequest(request);
  if (!auth) return reply.code(401).send({ error: 'Unauthorized' });

  const { slug } = request.params;
  if (!isValidSlug(slug)) return reply.code(404).send({ error: 'Not found' });

  const owner = await findOwner(slug);
  if (!owner) return reply.code(404).send({ error: 'Not found' });
  if (owner !== auth.user.id) return reply.code(403).send({ error: 'Forbidden' });

  await deleteEntity(slug);
  return reply.code(200).send({ ok: true });
}

export function buildDeletedPage(kind: EntityKind): string {
  const label = kind === 'short' ? 'short link' : kind;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>deleted — albbas</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#282828;color:#ebdbb2;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:center}h1{color:#fb4934;font-size:18px}p{color:#928374;font-size:14px}</style></head><body><div><h1>deleted</h1><p>the ${label} has been removed.</p></div></body></html>`;
}

export async function handleBrowserDelete(
  request: FastifyRequest<{ Params: { slug: string } }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { slug } = request.params;
  const sig = (request.query as Record<string, unknown>)['sig'];

  if (!isValidSlug(slug) || !isValidDeletionSignature(slug, sig)) {
    return reply.code(401).type('text/plain').send('401: unauthorized');
  }

  const kind = await deleteEntity(slug);
  if (!kind) return reply.code(404).type('text/plain').send('404: not found');

  return reply
    .code(200)
    .type('text/html; charset=utf-8')
    .header('cache-control', 'no-store')
    .send(buildDeletedPage(kind));
}

export function registerUploadRoutes(app: FastifyInstance): void {
  app.post('/api/upload', handleUpload);
  app.delete('/api/upload/:slug', handleDelete);
  app.get('/api/upload/:slug', handleBrowserDelete);
}
