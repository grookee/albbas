import { env } from './env.js';
import { buildServer } from './server.js';
import { ensureAdmin } from './db/seed.js';
import { closeRedis } from './lib/redis.js';

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down...`);
  await closeRedis();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

async function main(): Promise<void> {
  await ensureAdmin();

  const app = await buildServer();
  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
