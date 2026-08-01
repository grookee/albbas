import { describe, expect, it } from "vitest";
import { API_KEY_PREFIX, SLUG_ALPHABET, SLUG_LENGTH } from "./constants.js";
import { generateApiKey, generateInviteCode, generateSlug } from "./ids.js";

describe("generateSlug", () => {
  it("produces unique slugs of the expected length", () => {
    const slugs = new Set(Array.from({ length: 1000 }, () => generateSlug()));
    expect(slugs.size).toBe(1000);
    for (const slug of slugs) {
      expect(slug).toHaveLength(SLUG_LENGTH);
      for (const char of slug) {
        expect(SLUG_ALPHABET).toContain(char);
      }
    }
  });
});

describe("generateInviteCode", () => {
  it("formats as UPPER groups separated by dashes", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });
});

describe("generateApiKey", () => {
  it("prepends the live prefix and keeps a stable display prefix", () => {
    const { raw, prefix, full } = generateApiKey();
    expect(full).toBe(`${API_KEY_PREFIX}${raw}`);
    expect(full.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(prefix).toBe(raw.slice(0, 8));
    expect(full.length).toBe(API_KEY_PREFIX.length + 32);
  });
});
