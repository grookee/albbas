import { describe, expect, it } from 'vitest';
import { extensionForMimeType } from './mime.js';

describe('extensionForMimeType', () => {
  it('maps common image mime types', () => {
    expect(extensionForMimeType('image/png')).toBe('.png');
    expect(extensionForMimeType('image/jpeg')).toBe('.jpg');
    expect(extensionForMimeType('image/gif')).toBe('.gif');
    expect(extensionForMimeType('image/webp')).toBe('.webp');
  });

  it('normalizes case', () => {
    expect(extensionForMimeType('Image/PNG')).toBe('.png');
  });

  it('derives extensions for inline families without a known alias', () => {
    expect(extensionForMimeType('video/mp4')).toBe('.mp4');
    expect(extensionForMimeType('audio/mpeg')).toBe('.mpeg');
    expect(extensionForMimeType('text/css')).toBe('.css');
  });

  it('returns no extension for unknown application types', () => {
    expect(extensionForMimeType('application/octet-stream')).toBe('');
    expect(extensionForMimeType('')).toBe('');
  });
});
