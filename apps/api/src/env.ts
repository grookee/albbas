import 'dotenv/config';
import { z } from 'zod';
import { MAX_UPLOAD_BYTES } from '@albbas/shared';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32).default('dev-secret-do-not-use-in-production-0123456789'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),

  STORAGE_BACKEND: z.enum(['s3', 'local']).default('s3'),
  S3_ENDPOINT: z.string().default('https://supabase.co'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  S3_BUCKET: z.string().default(''),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === 'true')
    .default('true'),
  LOCAL_STORAGE_DIR: z.string().default('./data/uploads'),

  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(MAX_UPLOAD_BYTES),
  UPLOAD_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(200),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  ADMIN_EMAIL: z.string().trim().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
