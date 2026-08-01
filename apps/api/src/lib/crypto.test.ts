import { describe, expect, it } from 'vitest';
import { safeEqualHex, sha256Hex } from './crypto.js';

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
