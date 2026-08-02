import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import type { ApiKey, User } from '@prisma/client';
import { generateSessionToken, SESSION_COOKIE_NAME } from '@albbas/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from './env.js';
import { prisma } from './db/prisma.js';
import { sha256Hex } from './lib/crypto.js';

export type SafeUser = Omit<User, 'passwordHash'>;

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (name) cookies[name] = decodeURIComponent(part.slice(separator + 1).trim());
  }
  return cookies;
}

export async function hashPassword(password: string): Promise<string> {
  return argonHash(password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argonVerify(hash, password);
  } catch {
    return false;
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { tokenHash: sha256Hex(token), userId, expiresAt },
  });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: sha256Hex(token) } });
}

export async function getUserFromRequest(request: FastifyRequest): Promise<SafeUser | null> {
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE_NAME];
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  return session.user;
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  const secure = env.NODE_ENV === 'production';
  const maxAge = env.SESSION_TTL_DAYS * 24 * 60 * 60;
  reply.header(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Lax; Max-Age=${maxAge}`,
  );
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.header('Set-Cookie', `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`);
}

export function extractApiKey(request: FastifyRequest): string | null {
  const headerKey = request.headers['x-api-key'];
  if (typeof headerKey === 'string' && headerKey.length > 0) return headerKey;

  const authorization = request.headers.authorization;
  if (typeof authorization === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (match?.[1]) return match[1];
  }

  const query = request.query as Record<string, unknown>;
  const queryKey = query['api_key'];
  return typeof queryKey === 'string' && queryKey.length > 0 ? queryKey : null;
}

export async function getUserFromApiKey(
  rawKey: string,
): Promise<{ user: SafeUser; key: ApiKey } | null> {
  const key = await prisma.apiKey.findUnique({
    where: { keyHash: sha256Hex(rawKey) },
    include: { user: true },
  });
  if (!key || key.revokedAt) return null;

  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
    await prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }

  return { user: key.user, key };
}

export async function authenticateRequest(
  request: FastifyRequest,
): Promise<{ user: SafeUser; key: ApiKey | null } | null> {
  const sessionUser = await getUserFromRequest(request);
  if (sessionUser) return { user: sessionUser, key: null };

  const rawKey = extractApiKey(request);
  if (rawKey) {
    const found = await getUserFromApiKey(rawKey);
    if (found) return found;
  }

  return null;
}
