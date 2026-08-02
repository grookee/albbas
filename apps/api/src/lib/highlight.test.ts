import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  highlightCode,
  isHighlightableLanguage,
  renderPastePage,
  type PastePageOptions,
} from './highlight.js';

describe('escapeHtml', () => {
  it('escapes html metacharacters', () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });
});

describe('highlightCode', () => {
  it('escapes unknown languages instead of tokenizing', () => {
    expect(highlightCode('<b>x</b>', 'text')).toBe('&lt;b&gt;x&lt;/b&gt;');
  });

  it('tokenizes supported languages', () => {
    const out = highlightCode('const x = 1;', 'javascript');
    expect(out).toContain('hljs-keyword');
    expect(out).toContain('hljs-number');
  });
});

describe('isHighlightableLanguage', () => {
  it('knows the registered languages', () => {
    expect(isHighlightableLanguage('typescript')).toBe(true);
    expect(isHighlightableLanguage('rust')).toBe(true);
    expect(isHighlightableLanguage('nope')).toBe(false);
  });
});

describe('renderPastePage', () => {
  const base: PastePageOptions = {
    slug: 'abcdef12',
    title: null,
    language: 'javascript',
    content: 'const x = 1;\n// hi',
    baseUrl: 'https://i.mateakos.com',
    sizeBytes: 22,
    createdAt: new Date('2026-08-03T00:00:00Z'),
    visits: 3,
    highlighted: true,
  };

  it('renders line numbers and tokenizes content', () => {
    const html = renderPastePage({ ...base, highlighted: true });
    expect(html).toContain('<span class="hljs-keyword">const</span>');
    expect(html).toContain('<span class="pln">1</span>');
    expect(html).toContain('language-javascript');
    expect(html).toContain('raw');
    expect(html).toContain('?raw=1');
  });

  it('escapes malicious title and language', () => {
    const html = renderPastePage({
      ...base,
      title: `<img src=x onerror=alert(1)>`,
      language: '"><script>',
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
  });

  it('does not tokenize when highlighting is disabled', () => {
    const html = renderPastePage({ ...base, highlighted: false });
    expect(html).toContain('const x = 1;');
    expect(html).not.toContain('<span class="hljs-keyword">');
  });
});
