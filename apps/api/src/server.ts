import multipart from '@fastify/multipart';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { env } from './env.js';
import { prisma } from './db/prisma.js';
import { appRouter } from './routers/index.js';
import { registerFileRoutes } from './routes/files.js';
import { registerShareRoutes } from './routes/share.js';
import { registerSxcuRoutes } from './routes/sxcu.js';
import { registerUploadRoutes } from './routes/upload.js';
import { createContext } from './trpc.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV === 'development' ? { level: 'info' } : { level: 'warn' },
  });

  await app.register(multipart, {
    limits: {
      // One byte above the hard cap so oversize files trigger the
      // FST_REQ_FILE_TOO_LARGE path instead of silently truncating at the limit.
      fileSize: env.MAX_UPLOAD_BYTES + 1,
      files: 1,
      fields: 5,
    },
  });

  await app.register(fastifyTRPCPlugin, {
    prefix: '/api/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
    },
  });

  registerUploadRoutes(app);
  registerFileRoutes(app);
  registerShareRoutes(app);
  registerSxcuRoutes(app);

  app.get('/health', () => ({ ok: true }));

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.code(413).send({ error: `File exceeds the ${env.MAX_UPLOAD_BYTES} byte limit` });
    }
    if (error.code === 'FST_REQ_MULTIPART_BODY_FILE_COUNT_LIMIT') {
      return reply.code(400).send({ error: 'Only one file per upload is allowed' });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  });

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return app;
}
