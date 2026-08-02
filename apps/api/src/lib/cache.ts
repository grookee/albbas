import { getRedis } from './redis.js';

export interface UploadCacheEntry {
  s3Key: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
}

const CACHE_TTL_SECONDS = 60 * 60;
const PASTE_PAGE_MAX_CACHE_BYTES = 2 * 1024 * 1024;

function cacheKey(slug: string): string {
  return `upload:${slug}`;
}

function pastePageKey(slug: string): string {
  return `paste:page:${slug}`;
}

export async function getUploadCache(slug: string): Promise<UploadCacheEntry | null> {
  const redis = await getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(cacheKey(slug));
    return raw ? (JSON.parse(raw) as UploadCacheEntry) : null;
  } catch {
    return null;
  }
}

export async function setUploadCache(slug: string, entry: UploadCacheEntry): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.set(cacheKey(slug), JSON.stringify(entry), 'EX', CACHE_TTL_SECONDS);
  } catch {
    // Redis is optional; ignore cache write failures.
  }
}

export async function delUploadCache(slug: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.del(cacheKey(slug));
  } catch {
    // Redis is optional; ignore cache write failures.
  }
}

export async function getPastePageCache(slug: string): Promise<string | null> {
  const redis = await getRedis();
  if (!redis) return null;
  try {
    return await redis.get(pastePageKey(slug));
  } catch {
    return null;
  }
}

export async function setPastePageCache(slug: string, html: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  if (Buffer.byteLength(html) > PASTE_PAGE_MAX_CACHE_BYTES) return;
  try {
    await redis.set(pastePageKey(slug), html, 'EX', CACHE_TTL_SECONDS);
  } catch {
    // Redis is optional; ignore cache write failures.
  }
}

export async function delPastePageCache(slug: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.del(pastePageKey(slug));
  } catch {
    // Redis is optional; ignore cache write failures.
  }
}
