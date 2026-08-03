import { describe, expect, it } from 'vitest';
import {
  deletionSignature,
  decryptSecret,
  encryptionKeyFromSecret,
  encryptSecret,
  safeEqualHex,
  sha256Hex,
  verifyDeletionSignature,
} from './crypto.js';

describe('sha256Hex', () => {
  it('produces a stable 64-char hex digest', () => {
    const hash = sha256Hex('hello');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex('hello')).toBe(hash);
    expect(sha256Hex('hello')).not.toBe(sha256Hex('hellp'));
  });
});

describe('safeEqualHex', () => {
  it('compares equal hashes as true', () => {
    const hash = sha256Hex('secret');
    expect(safeEqualHex(hash, hash)).toBe(true);
  });

  it('compares different hashes as false', () => {
    expect(safeEqualHex(sha256Hex('a'), sha256Hex('b'))).toBe(false);
  });

  it('rejects mismatched lengths', () => {
    expect(safeEqualHex(sha256Hex('a'), sha256Hex('ab'))).toBe(false);
  });

  it('rejects empty input', () => {
    expect(safeEqualHex('', '')).toBe(false);
  });
});

describe('deletionSignature / verifyDeletionSignature', () => {
  const secret = 'test-encryption-key-0123456789-0123456789';

  it('signs and verifies a slug', () => {
    const sig = deletionSignature('abc12345', secret);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyDeletionSignature('abc12345', sig, secret)).toBe(true);
  });

  it('binds the signature to the slug', () => {
    const sig = deletionSignature('abc12345', secret);
    expect(verifyDeletionSignature('otherslug', sig, secret)).toBe(false);
  });

  it('rejects a wrong secret and garbage', () => {
    const sig = deletionSignature('abc12345', secret);
    expect(verifyDeletionSignature('abc12345', sig, 'other-secret-0000000000000000000000000')).toBe(
      false,
    );
    expect(verifyDeletionSignature('abc12345', 'garbage', secret)).toBe(false);
    expect(verifyDeletionSignature('abc12345', '', secret)).toBe(false);
  });
});

describe('encryptSecret / decryptSecret', () => {
  const key = encryptionKeyFromSecret('test-encryption-key-0123456789-0123456789');

  it('round-trips a secret', () => {
    const encrypted = encryptSecret('albb_abc123', key);
    expect(encrypted).not.toContain('albb_abc123');
    expect(encrypted.startsWith('v1.')).toBe(true);
    expect(decryptSecret(encrypted, key)).toBe('albb_abc123');
  });

  it('produces a different ciphertext each time', () => {
    const a = encryptSecret('secret', key);
    const b = encryptSecret('secret', key);
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with a different key', () => {
    const encrypted = encryptSecret('secret', key);
    const otherKey = encryptionKeyFromSecret('another-encryption-key-0123456789-0123456789');
    expect(() => decryptSecret(encrypted, otherKey)).toThrow();
  });

  it('rejects malformed payloads', () => {
    expect(() => decryptSecret('garbage', key)).toThrow();
    expect(() => decryptSecret('v2.aa.bb.cc', key)).toThrow();
  });
});
