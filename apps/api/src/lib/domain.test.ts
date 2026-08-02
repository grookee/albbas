import { describe, expect, it } from "vitest";
import { baseUrlForUser, toAllowedDomain, toDbDomain } from "./domain.js";

describe("toAllowedDomain", () => {
  it("maps both enum values to shared domain strings", () => {
    expect(toAllowedDomain("MATEAKOS_COM")).toBe("mateakos.com");
    expect(toAllowedDomain("BUFET_LOL")).toBe("bufet.lol");
    expect(toAllowedDomain(null)).toBeNull();
  });
});

describe("toDbDomain", () => {
  it("round-trips shared domains back to the enum", () => {
    expect(toDbDomain("mateakos.com")).toBe("MATEAKOS_COM");
    expect(toDbDomain("bufet.lol")).toBe("BUFET_LOL");
  });
});

describe("baseUrlForUser", () => {
  it("returns null when no domain is configured", () => {
    expect(baseUrlForUser({ domain: null, subdomain: null })).toBeNull();
  });

  it("builds a subdomain URL", () => {
    expect(baseUrlForUser({ domain: "MATEAKOS_COM", subdomain: "i" })).toBe(
      "https://i.mateakos.com",
    );
  });

  it("returns null when no subdomain is configured", () => {
    expect(baseUrlForUser({ domain: "BUFET_LOL", subdomain: null })).toBeNull();
  });
});
