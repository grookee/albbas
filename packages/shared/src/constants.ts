export const ALLOWED_DOMAINS = ['mateakos.com', 'bufet.lol'] as const;
export type AllowedDomain = (typeof ALLOWED_DOMAINS)[number];

export const SLUG_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
export const SLUG_LENGTH = 9;

export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_GROUPS = 4;
export const INVITE_CODE_GROUP_LENGTH = 4;

export const API_KEY_PREFIX = 'alb_live_';
export const API_KEY_LENGTH = 32;
export const API_KEY_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const SESSION_COOKIE_NAME = 'albbas_session';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const SUBDOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export const PUBLIC_CACHE_CONTROL = 'public, max-age=31536000, immutable';
