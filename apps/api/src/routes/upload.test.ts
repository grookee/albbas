import type { FastifyReply, FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deletionSignature } from '../lib/crypto.js';
import {
  buildDeletedPage,
  buildPasteMetadata,
  deleteEntity,
  extractUrlField,
  getEntityKind,
  handleBrowserDelete,
  isValidDeletionSignature,
  isValidSlug,
  pasteSizeError,
  sanitizeFilename,
} from './upload.js';

const envMock = vi.hoisted(() => ({
  ENCRYPTION_KEY: 'e'.repeat(40),
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
  PASTE_MAX_BYTES: 8 * 1024 * 1024,
  UPLOAD_RATE_LIMIT_PER_HOUR: 200,
}));

const prismaMock = vi.hoisted(() => ({
  shortUrl: { findUnique: vi.fn(), delete: vi.fn(), create: vi.fn() },
  paste: { findUnique: vi.fn(), delete: vi.fn(), create: vi.fn() },
  upload: { findUnique: vi.fn(), delete: vi.fn(), create: vi.fn() },
}));

const storageMock = vi.hoisted(() => ({
  put: vi.fn(async () => {}),
  delete: vi.fn(async () => {}),
}));

vi.mock('../env.js', () => ({ env: envMock }));
vi.mock('../db/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../storage/instance.js', () => ({ storage: storageMock }));
vi.mock('../lib/cache.js', () => ({
  setUploadCache: vi.fn(async () => {}),
  delUploadCache: vi.fn(async () => {}),
  delPastePageCache: vi.fn(async () => {}),
}));
vi.mock('../auth.js', () => ({
  authenticateRequest: vi.fn(async () => null),
}));
vi.mock('../lib/image.js', () => ({
  autoOrientImage: vi.fn(async (buffer: Buffer) => buffer),
}));
vi.mock('../lib/rateLimit.js', () => ({
  isRateLimited: vi.fn(async () => false),
}));

function createReply() {
  const code = vi.fn();
  const type = vi.fn();
  const header = vi.fn();
  const send = vi.fn();
  const reply = { code, type, header, send };
  code.mockImplementation(() => reply);
  type.mockImplementation(() => reply);
  header.mockImplementation(() => reply);
  send.mockImplementation(() => reply);
  return reply;
}

function createRequest(
  params: { slug: string },
  query: Record<string, unknown>,
): FastifyRequest<{ Params: { slug: string } }> {
  return { params, query } as unknown as FastifyRequest<{ Params: { slug: string } }>;
}

describe('sanitizeFilename', () => {
  it('strips directory components', () => {
    expect(sanitizeFilename('a/b/c.txt')).toBe('c.txt');
    expect(sanitizeFilename('a\\b.txt')).toBe('b.txt');
  });

  it('replaces control and invalid characters', () => {
    expect(sanitizeFilename('a\nb')).toBe('a_b');
    expect(sanitizeFilename('a:b')).toBe('a_b');
    expect(sanitizeFilename('"<>|:*?')).toBe('_______');
  });

  it('limits the name to 255 characters', () => {
    expect(sanitizeFilename('x'.repeat(300))).toHaveLength(255);
  });
});

describe('isValidSlug', () => {
  it('accepts 6-9 alphanumeric slugs', () => {
    expect(isValidSlug('abc123')).toBe(true);
    expect(isValidSlug('Abcdef9')).toBe(true);
    expect(isValidSlug('abcdefghi')).toBe(true);
  });

  it('rejects slugs outside the pattern', () => {
    expect(isValidSlug('abc')).toBe(false);
    expect(isValidSlug('abcdefghij')).toBe(false);
    expect(isValidSlug('abc-def')).toBe(false);
    expect(isValidSlug('abc_123')).toBe(false);
  });
});

describe('getEntityKind', () => {
  it('maps slug length to entity kind', () => {
    expect(getEntityKind('abcdef')).toBe('short');
    expect(getEntityKind('abcdefgh')).toBe('paste');
    expect(getEntityKind('abcdefghi')).toBe('upload');
  });

  it('returns null for invalid slugs', () => {
    expect(getEntityKind('ab')).toBeNull();
    expect(getEntityKind('abc-123')).toBeNull();
  });
});

describe('buildPasteMetadata', () => {
  it('prefers a known requested language', () => {
    expect(buildPasteMetadata('notes.txt', 'text/plain', { language: 'typescript' })).toEqual({
      language: 'typescript',
      title: null,
    });
  });

  it('falls back to detection for unknown language', () => {
    expect(
      buildPasteMetadata('script.ts', 'application/octet-stream', { language: 'nope' }),
    ).toEqual({ language: 'typescript', title: null });
  });

  it('normalizes the title', () => {
    expect(buildPasteMetadata('a.txt', 'text/plain', { title: '  hello  ' })).toEqual({
      language: 'text',
      title: 'hello',
    });
  });
});

describe('pasteSizeError', () => {
  it('returns an error message when over the limit', () => {
    expect(pasteSizeError(envMock.PASTE_MAX_BYTES + 1)).toBe(
      `Text exceeds the ${envMock.PASTE_MAX_BYTES} byte limit`,
    );
  });

  it('returns null within the limit', () => {
    expect(pasteSizeError(envMock.PASTE_MAX_BYTES)).toBeNull();
  });
});

describe('extractUrlField', () => {
  it('prefers the multipart field over the query', () => {
    expect(
      extractUrlField({ url: 'https://field.example' }, { url: 'https://query.example' }),
    ).toBe('https://field.example');
  });

  it('falls back to the query url', () => {
    expect(extractUrlField({}, { url: 'https://query.example' })).toBe('https://query.example');
  });

  it('returns null when absent', () => {
    expect(extractUrlField({}, {})).toBeNull();
    expect(extractUrlField({}, { url: 42 })).toBeNull();
  });
});

describe('isValidDeletionSignature', () => {
  it('accepts a valid signature for the slug', () => {
    expect(
      isValidDeletionSignature('abcdef', deletionSignature('abcdef', envMock.ENCRYPTION_KEY)),
    ).toBe(true);
  });

  it('rejects wrong slugs, non-strings, and empty strings', () => {
    expect(
      isValidDeletionSignature('abcdef', deletionSignature('abcdeg', envMock.ENCRYPTION_KEY)),
    ).toBe(false);
    expect(isValidDeletionSignature('abcdef', 42)).toBe(false);
    expect(isValidDeletionSignature('abcdef', '')).toBe(false);
  });
});

describe('deleteEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a short url', async () => {
    prismaMock.shortUrl.findUnique.mockResolvedValue({ id: '1' });
    await expect(deleteEntity('abcdef')).resolves.toBe('short');
    expect(prismaMock.shortUrl.delete).toHaveBeenCalledWith({ where: { id: '1' } });
  });

  it('deletes a paste and its storage and cache', async () => {
    prismaMock.paste.findUnique.mockResolvedValue({
      id: '1',
      s3Key: 'pastes/abcdefgh',
      slug: 'abcdefgh',
    });
    await expect(deleteEntity('abcdefgh')).resolves.toBe('paste');
    expect(storageMock.delete).toHaveBeenCalledWith('pastes/abcdefgh');
    expect(prismaMock.paste.delete).toHaveBeenCalledWith({ where: { id: '1' } });
  });

  it('deletes an upload and its storage and cache', async () => {
    prismaMock.upload.findUnique.mockResolvedValue({
      id: '1',
      s3Key: 'uploads/abcdefghi',
      slug: 'abcdefghi',
    });
    await expect(deleteEntity('abcdefghi')).resolves.toBe('upload');
    expect(storageMock.delete).toHaveBeenCalledWith('uploads/abcdefghi');
    expect(prismaMock.upload.delete).toHaveBeenCalledWith({ where: { id: '1' } });
  });

  it('returns null when the entity does not exist', async () => {
    prismaMock.shortUrl.findUnique.mockResolvedValue(null);
    await expect(deleteEntity('abcdef')).resolves.toBeNull();
    expect(prismaMock.shortUrl.delete).not.toHaveBeenCalled();
  });

  it('returns null for invalid slugs', async () => {
    await expect(deleteEntity('bad slug!')).resolves.toBeNull();
    expect(prismaMock.shortUrl.findUnique).not.toHaveBeenCalled();
  });
});

describe('buildDeletedPage', () => {
  it('renders a page for each kind', () => {
    expect(buildDeletedPage('short')).toContain('the short link has been removed');
    expect(buildDeletedPage('paste')).toContain('the paste has been removed');
    expect(buildDeletedPage('upload')).toContain('the upload has been removed');
  });
});

describe('handleBrowserDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests with a missing signature', async () => {
    const reply = createReply();
    await handleBrowserDelete(
      createRequest({ slug: 'abcdef' }, {}),
      reply as unknown as FastifyReply,
    );
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith('401: unauthorized');
  });

  it('rejects requests with an invalid signature', async () => {
    const reply = createReply();
    await handleBrowserDelete(
      createRequest({ slug: 'abcdef' }, { sig: 'deadbeef' }),
      reply as unknown as FastifyReply,
    );
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith('401: unauthorized');
  });

  it('deletes and renders the deleted page for a valid signature', async () => {
    prismaMock.shortUrl.findUnique.mockResolvedValue({ id: '1' });
    const reply = createReply();
    const sig = deletionSignature('abcdef', envMock.ENCRYPTION_KEY);
    await handleBrowserDelete(
      createRequest({ slug: 'abcdef' }, { sig }),
      reply as unknown as FastifyReply,
    );
    expect(reply.header).toHaveBeenCalledWith('cache-control', 'no-store');
    expect(reply.send).toHaveBeenCalledWith(
      expect.stringContaining('the short link has been removed'),
    );
  });

  it('returns 404 for unknown entities', async () => {
    prismaMock.shortUrl.findUnique.mockResolvedValue(null);
    const reply = createReply();
    const sig = deletionSignature('abcdef', envMock.ENCRYPTION_KEY);
    await handleBrowserDelete(
      createRequest({ slug: 'abcdef' }, { sig }),
      reply as unknown as FastifyReply,
    );
    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith('404: not found');
  });
});
