export const ALLOWED_DOMAINS = ['mateakos.com', 'bufet.lol'] as const;
export type AllowedDomain = (typeof ALLOWED_DOMAINS)[number];

export const SLUG_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
export const SLUG_LENGTH = 9;
export const SHORT_SLUG_LENGTH = 6;
export const PASTE_SLUG_LENGTH = 8;

export const PASTE_LANGUAGES = [
  'text',
  'plaintext',
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'diff',
  'dockerfile',
  'go',
  'graphql',
  'html',
  'ini',
  'java',
  'javascript',
  'json',
  'kotlin',
  'less',
  'lua',
  'makefile',
  'markdown',
  'nginx',
  'objectivec',
  'perl',
  'php',
  'python',
  'python-repl',
  'ruby',
  'rust',
  'scss',
  'shell',
  'sql',
  'typescript',
  'xml',
  'yaml',
] as const;
export type PasteLanguage = (typeof PASTE_LANGUAGES)[number];

export const TARGET_URL_MAX_LENGTH = 2048;

export const PASTE_HIGHLIGHT_MAX_BYTES = 1024 * 1024;

export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_GROUPS = 4;
export const INVITE_CODE_GROUP_LENGTH = 4;

export const API_KEY_PREFIX = 'alb_live_';
export const API_KEY_LENGTH = 32;
export const API_KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const SESSION_COOKIE_NAME = 'albbas_session';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const SUBDOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export const PUBLIC_CACHE_CONTROL = 'public, max-age=3600';
