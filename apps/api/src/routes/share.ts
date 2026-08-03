import {
  PASTE_HIGHLIGHT_MAX_BYTES,
  PASTE_SLUG_LENGTH,
  PUBLIC_CACHE_CONTROL,
  SHORT_SLUG_LENGTH,
} from '@albbas/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db/prisma.js';
import { env } from '../env.js';
import { getPastePageCache, setPastePageCache } from '../lib/cache.js';
import { renderPastePage } from '../lib/highlight.js';
import { storage } from '../storage/instance.js';
import { serveUploadBySlug } from './files.js';

const SLUG_PATTERN = /^([A-Za-z0-9]{6,9})(?:\.[A-Za-z0-9]+)?$/;

function reply404(reply: FastifyReply): FastifyReply {
  return reply.code(404).type('text/plain').send('404: not found');
}

async function readObject(key: string): Promise<Buffer> {
  const object = await storage.get(key);
  const chunks: Buffer[] = [];
  for await (const chunk of object.stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function handleShortUrl(slug: string, reply: FastifyReply): Promise<FastifyReply> {
  const shortUrl = await prisma.shortUrl.findUnique({ where: { slug } });
  if (!shortUrl) return reply404(reply);

  void prisma.shortUrl
    .updateMany({ where: { slug }, data: { visits: { increment: 1 } } })
    .catch(() => undefined);

  return reply
    .code(302)
    .header('location', shortUrl.targetUrl)
    .header('cache-control', 'no-store')
    .send();
}

async function handlePaste(
  slug: string,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const paste = await prisma.paste.findUnique({ where: { slug } });
  if (!paste) return reply404(reply);

  void prisma.paste
    .updateMany({ where: { slug }, data: { visits: { increment: 1 } } })
    .catch(() => undefined);

  let content: string;
  try {
    const buffer = await readObject(paste.s3Key);
    content = buffer.toString('utf8');
  } catch (err) {
    request.log.warn({ err, slug }, 'Failed to read paste content from storage');
    return reply.code(502).type('text/plain').send('502: upstream error');
  }

  if (request.query && (request.query as Record<string, unknown>).raw === '1') {
    return reply
      .type('text/plain; charset=utf-8')
      .header('content-length', String(Buffer.byteLength(content)))
      .header('content-disposition', 'inline; filename="paste.txt"')
      .header('cache-control', PUBLIC_CACHE_CONTROL)
      .header('x-content-type-options', 'nosniff')
      .send(content);
  }

  const cached = await getPastePageCache(slug);
  if (cached) {
    return reply
      .type('text/html; charset=utf-8')
      .header('cache-control', PUBLIC_CACHE_CONTROL)
      .header('x-content-type-options', 'nosniff')
      .header(
        'content-security-policy',
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'none'",
      )
      .send(cached);
  }

  const highlighted = paste.sizeBytes <= PASTE_HIGHLIGHT_MAX_BYTES;
  const html = renderPastePage({
    slug,
    title: paste.title,
    language: paste.language,
    content,
    baseUrl: paste.baseUrl,
    webUrl: env.APP_URL,
    sizeBytes: paste.sizeBytes,
    createdAt: paste.createdAt,
    visits: paste.visits,
    highlighted,
  });
  await setPastePageCache(slug, html);

  return reply
    .type('text/html; charset=utf-8')
    .header('cache-control', PUBLIC_CACHE_CONTROL)
    .header('x-content-type-options', 'nosniff')
    .header(
      'content-security-policy',
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'none'",
    )
    .send(html);
}

async function handleShare(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  const match = (request.params as { slug: string }).slug.match(SLUG_PATTERN);
  const slug = match?.[1] ?? null;
  if (!slug) return reply404(reply);

  if (slug.length === SHORT_SLUG_LENGTH) {
    return handleShortUrl(slug, reply);
  }
  if (slug.length === PASTE_SLUG_LENGTH) {
    return handlePaste(slug, request, reply);
  }
  return serveUploadBySlug(slug, request, reply);
}

export function registerShareRoutes(app: FastifyInstance): void {
  app.get('/:slug', handleShare);
}
