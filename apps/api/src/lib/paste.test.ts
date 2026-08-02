import { describe, expect, it } from 'vitest';
import {
  detectPasteLanguage,
  isTextUpload,
  languageFromFilename,
  validateTargetUrl,
} from './paste.js';

describe('languageFromFilename', () => {
  it('maps common code extensions', () => {
    expect(languageFromFilename('server.ts')).toBe('typescript');
    expect(languageFromFilename('main.go')).toBe('go');
    expect(languageFromFilename('README.md')).toBe('markdown');
    expect(languageFromFilename('Dockerfile')).toBe('dockerfile');
    expect(languageFromFilename('notes.txt')).toBe('text');
  });

  it('returns null for unknown extensions', () => {
    expect(languageFromFilename('archive.zip')).toBeNull();
    expect(languageFromFilename('no-extension')).toBeNull();
  });
});

describe('detectPasteLanguage', () => {
  it('prefers the mime type', () => {
    expect(detectPasteLanguage('anything', 'text/plain')).toBe('text');
    expect(detectPasteLanguage('anything', 'application/json')).toBe('json');
  });

  it('falls back to the filename', () => {
    expect(detectPasteLanguage('script.ts', 'application/octet-stream')).toBe('typescript');
    expect(detectPasteLanguage('unknown.bin', 'application/octet-stream')).toBe('text');
  });
});

describe('isTextUpload', () => {
  it('treats text mime types as text uploads', () => {
    expect(isTextUpload('a.txt', 'text/plain')).toBe(true);
    expect(isTextUpload('a.log', 'text/plain')).toBe(true);
  });

  it('treats code mime types as text uploads', () => {
    expect(isTextUpload('a.json', 'application/json')).toBe(true);
    expect(isTextUpload('a.js', 'application/javascript')).toBe(true);
  });

  it('falls back to the extension for octet-stream', () => {
    expect(isTextUpload('main.py', 'application/octet-stream')).toBe(true);
    expect(isTextUpload('archive.zip', 'application/octet-stream')).toBe(false);
  });

  it('rejects binary mime types', () => {
    expect(isTextUpload('photo.png', 'image/png')).toBe(false);
    expect(isTextUpload('video.mp4', 'video/mp4')).toBe(false);
  });
});

describe('validateTargetUrl', () => {
  it('accepts http and https urls', () => {
    expect(validateTargetUrl('https://example.com/a/b?c=1')).toBe('https://example.com/a/b?c=1');
    expect(validateTargetUrl('  http://example.com  ')).toBe('http://example.com/');
  });

  it('rejects non-http schemes', () => {
    expect(validateTargetUrl('javascript:alert(1)')).toBeNull();
    expect(validateTargetUrl('file:///etc/passwd')).toBeNull();
    expect(validateTargetUrl('data:text/plain;base64,AA==')).toBeNull();
  });

  it('rejects malformed and credential-bearing urls', () => {
    expect(validateTargetUrl('not a url')).toBeNull();
    expect(validateTargetUrl('https://')).toBeNull();
    expect(validateTargetUrl('https://user:pass@example.com')).toBeNull();
    expect(validateTargetUrl('')).toBeNull();
  });

  it('rejects urls with control characters', () => {
    expect(validateTargetUrl('https://example.com/\npath')).toBeNull();
  });

  it('rejects overly long urls', () => {
    expect(validateTargetUrl(`https://example.com/${'a'.repeat(3000)}`)).toBeNull();
  });
});
