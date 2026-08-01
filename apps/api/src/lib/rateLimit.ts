import { getRedis } from './redis.js';

export async function isRateLimited(
  namespace: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return false;

  try {
    const key = `rl:${namespace}:${identifier}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return count > limit;
  } catch {
    // Redis is optional; never block uploads because caching is down.
    return false;
  }
}
