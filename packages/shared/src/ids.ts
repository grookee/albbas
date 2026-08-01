import {
  API_KEY_ALPHABET,
  API_KEY_LENGTH,
  API_KEY_PREFIX,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_GROUP_LENGTH,
  INVITE_CODE_GROUPS,
  SLUG_ALPHABET,
  SLUG_LENGTH,
} from "./constants.js";

function randomChars(length: number, alphabet: string): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    const index = bytes[i]! % alphabet.length;
    out += alphabet[index]!;
  }
  return out;
}

export function generateSlug(): string {
  return randomChars(SLUG_LENGTH, SLUG_ALPHABET);
}

export function generateInviteCode(): string {
  const groups: string[] = [];
  for (let i = 0; i < INVITE_CODE_GROUPS; i++) {
    groups.push(randomChars(INVITE_CODE_GROUP_LENGTH, INVITE_CODE_ALPHABET));
  }
  return groups.join("-");
}

export function generateApiKey(): {
  prefix: string;
  raw: string;
  full: string;
} {
  const raw = randomChars(API_KEY_LENGTH, API_KEY_ALPHABET);
  return { prefix: raw.slice(0, 8), raw, full: `${API_KEY_PREFIX}${raw}` };
}

export function generateSessionToken(): string {
  return `sess_${randomChars(48, API_KEY_ALPHABET)}`;
}
