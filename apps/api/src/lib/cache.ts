import { getRedis } from './redis.js';

export interface UploadCacheEntry {
  s3Key: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
}

const CACHE_TTL_SECONDS = 60 * 60;

function cacheKey(slug: string): string {
  return `upload:${slug}`;
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
