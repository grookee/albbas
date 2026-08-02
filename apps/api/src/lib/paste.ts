import { PASTE_LANGUAGES, TARGET_URL_MAX_LENGTH } from '@albbas/shared';

type PasteLanguageName = string;

const FILENAME_LANGUAGES: Record<string, PasteLanguageName> = {
  bash: 'bash',
  c: 'c',
  cc: 'cpp',
  cjs: 'javascript',
  conf: 'ini',
  config: 'ini',
  cpp: 'cpp',
  cs: 'csharp',
  css: 'css',
  cxx: 'cpp',
  diff: 'diff',
  dockerfile: 'dockerfile',
  gql: 'graphql',
  go: 'go',
  graphql: 'graphql',
  h: 'c',
  hpp: 'cpp',
  htm: 'xml',
  html: 'xml',
  ini: 'ini',
  java: 'java',
  js: 'javascript',
  json: 'json',
  jsonc: 'json',
  kt: 'kotlin',
  kts: 'kotlin',
  less: 'less',
  lua: 'lua',
  make: 'makefile',
  makefile: 'makefile',
  markdown: 'markdown',
  md: 'markdown',
  mjs: 'javascript',
  nginx: 'nginx',
  patch: 'diff',
  perl: 'perl',
  php: 'php',
  pl: 'perl',
  properties: 'ini',
  py: 'python',
  py3: 'python',
  rb: 'ruby',
  rs: 'rust',
  scss: 'scss',
  sh: 'bash',
  sql: 'sql',
  toml: 'ini',
  ts: 'typescript',
  tsx: 'typescript',
  txt: 'text',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'bash',
};

const MIME_LANGUAGES: Record<string, PasteLanguageName> = {
  'application/json': 'json',
  'application/javascript': 'javascript',
  'application/ld+json': 'json',
  'application/x-httpd-php': 'php',
  'application/x-sh': 'bash',
  'application/x-yaml': 'yaml',
  'application/xml': 'xml',
  'text/css': 'css',
  'text/html': 'xml',
  'text/javascript': 'javascript',
  'text/markdown': 'markdown',
  'text/x-sh': 'bash',
};

const CODE_MIMES = new Set([
  'application/json',
  'application/javascript',
  'application/ld+json',
  'application/x-httpd-php',
  'application/x-sh',
  'application/x-yaml',
  'application/xml',
]);

export function languageFromFilename(filename: string): string | null {
  const base = filename.split(/[\\/]/).pop() ?? '';
  const lower = base.toLowerCase();
  if (lower === 'dockerfile') return 'dockerfile';
  if (lower === 'makefile') return 'makefile';
  if (lower.endsWith('.dockerfile')) return 'dockerfile';
  const dot = lower.lastIndexOf('.');
  if (dot <= 0) return null;
  return FILENAME_LANGUAGES[lower.slice(dot + 1)] ?? null;
}

export function languageFromMime(mimeType: string): string | null {
  const normalized = mimeType.toLowerCase();
  if (normalized.startsWith('text/')) {
    return MIME_LANGUAGES[normalized] ?? 'text';
  }
  return MIME_LANGUAGES[normalized] ?? null;
}

export function detectPasteLanguage(filename: string, mimeType: string): string {
  const fromMime = languageFromMime(mimeType);
  if (fromMime) return fromMime;
  return languageFromFilename(filename) ?? 'text';
}

export function isTextUpload(filename: string, mimeType: string): boolean {
  const normalized = mimeType.toLowerCase();
  if (normalized.startsWith('text/')) return true;
  if (CODE_MIMES.has(normalized)) return true;
  if (normalized === 'application/octet-stream' || normalized === '') {
    return languageFromFilename(filename) !== null;
  }
  return false;
}

export function isKnownPasteLanguage(language: string): boolean {
  return (PASTE_LANGUAGES as readonly string[]).includes(language);
}

export function validateTargetUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > TARGET_URL_MAX_LENGTH) return null;
  if (/[\p{Cc}]/u.test(trimmed)) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (!url.hostname) return null;

  return url.toString();
}
