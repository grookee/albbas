import { describe, expect, it } from "vitest";
import { baseUrlFor, domainSelectionSchema } from "./schemas.js";

describe("domainSelectionSchema", () => {
  it("accepts a valid subdomain on an allowed domain", () => {
    const result = domainSelectionSchema.safeParse({
      domain: "mateakos.com",
      subdomain: "i",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a bare domain when no subdomain is given", () => {
    const result = domainSelectionSchema.safeParse({ domain: "bufet.lol" });
    expect(result.success).toBe(true);
  });

  it("rejects disallowed domains", () => {
    const result = domainSelectionSchema.safeParse({
      domain: "evil.example",
      subdomain: "i",
    });
    expect(result.success).toBe(false);
  });

  it("rejects malformed subdomains", () => {
    for (const subdomain of ["-foo", "foo-", "Foo_Bar", "a".repeat(64)]) {
      const result = domainSelectionSchema.safeParse({
        domain: "mateakos.com",
        subdomain,
      });
      expect(result.success).toBe(false);
    }
  });
});

describe("baseUrlFor", () => {
  it("builds a https subdomain URL", () => {
    expect(baseUrlFor({ domain: "mateakos.com", subdomain: "i" })).toBe(
      "https://i.mateakos.com",
    );
  });

  it("builds an apex URL when no subdomain is set", () => {
    expect(baseUrlFor({ domain: "bufet.lol" })).toBe("https://bufet.lol");
  });
});
