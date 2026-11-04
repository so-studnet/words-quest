import { describe, expect, it } from "vitest";
import { checkOrigin, corsHeaders, normalizeOrigin, parseAllowedOrigins } from "./cors";

const self = "https://words-quest.vercel.app";

describe("normalizeOrigin", () => {
  it("lowercases and drops paths and trailing slashes", () => {
    expect(normalizeOrigin("https://My-Blog.example.com/")).toBe("https://my-blog.example.com");
    expect(normalizeOrigin(" https://a.example.com/path?x=1 ")).toBe("https://a.example.com");
    expect(normalizeOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });
  it("keeps * and rejects junk", () => {
    expect(normalizeOrigin("*")).toBe("*");
    expect(normalizeOrigin("null")).toBeNull();
    expect(normalizeOrigin("example.com")).toBeNull();
    expect(normalizeOrigin("ftp://example.com")).toBeNull();
  });
});

describe("parseAllowedOrigins", () => {
  it("splits, normalizes, de-duplicates, and drops invalid entries", () => {
    expect(parseAllowedOrigins("https://a.com/, https://A.com ,bad, ,https://b.com")).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });
  it("returns [] when unset", () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins("")).toEqual([]);
  });
});

describe("checkOrigin", () => {
  const allowed = ["https://blog.example.com"];
  it("allows requests without Origin (same-site GET, curl, servers)", () => {
    expect(checkOrigin(null, self, allowed)).toBe("no_origin");
    expect(checkOrigin("", self, allowed)).toBe("no_origin");
  });
  it("recognizes this site", () => {
    expect(checkOrigin("https://Words-Quest.vercel.app", self, [])).toBe("same_origin");
  });
  it("allows listed origins only", () => {
    expect(checkOrigin("https://blog.example.com", self, allowed)).toBe("allowed");
    expect(checkOrigin("https://evil.example.com", self, allowed)).toBe("forbidden");
    expect(checkOrigin("http://blog.example.com", self, allowed)).toBe("forbidden"); // scheme matters
  });
  it("allows anyone with *", () => {
    expect(checkOrigin("https://anything.example", self, ["*"])).toBe("allowed");
  });
  it("forbids the opaque null origin", () => {
    expect(checkOrigin("null", self, ["*"])).toBe("forbidden");
  });
});

describe("corsHeaders", () => {
  it("echoes an allowed origin", () => {
    const h = corsHeaders("https://blog.example.com", "allowed");
    expect(h["Access-Control-Allow-Origin"]).toBe("https://blog.example.com");
    expect(h.Vary).toBe("Origin");
    expect(h["Access-Control-Expose-Headers"]).toBe("X-Cache");
  });
  it("adds nothing otherwise", () => {
    expect(corsHeaders("https://x.com", "forbidden")).toEqual({});
    expect(corsHeaders(null, "no_origin")).toEqual({});
    expect(corsHeaders("https://words-quest.vercel.app", "same_origin")).toEqual({});
  });
});
