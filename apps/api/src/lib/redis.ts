import { Redis } from 'ioredis';
import { env } from '../env.js';

let client: Redis | null = null;
let connecting: Promise<Redis | null> | null = null;

export async function getRedis(): Promise<Redis | null> {
  if (client) return client;
  if (!connecting) {
    connecting = (async () => {
      const candidate = new Redis(env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      try {
        await candidate.connect();
      } catch {
        console.warn('Redis unavailable; caching and rate limiting disabled.');
        candidate.disconnect();
        return null;
      }
      client = candidate;
      return candidate;
    })();
  }
  return connecting;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
  connecting = null;
}
