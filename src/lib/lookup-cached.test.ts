import { describe, expect, it } from "vitest";
import type { AiProvider } from "@/lib/ai/provider";
import type { LookupResult } from "@/lib/domain/lookup-result";
import { parseQuery, type ParsedQuery } from "@/lib/domain/query";
import type { LookupCache, RateLimiter } from "@/lib/store";
import { lookupCached, type LookupDeps } from "./lookup";

const query = (parseQuery("Happy") as { ok: true; query: ParsedQuery }).query;
const aiReply = JSON.stringify({ senses: [{ partOfSpeech: "adjective", definition: "Feeling pleasure." }] });

function provider(reply = aiReply): AiProvider & { calls: number } {
  return { name: "groq", model: "m1", calls: 0, async complete() { this.calls++; return reply; } };
}

class MemoryCache implements LookupCache {
  rows = new Map<string, { version: number; result: LookupResult; model: string }>();
  fail = false;
  async get(key: string, version: number) {
    if (this.fail) throw new Error("db down");
    const r = this.rows.get(key);
    return r && r.version === version ? r.result : null;
  }
  async put(key: string, version: number, result: LookupResult, model: string) {
    if (this.fail) throw new Error("db down");
    this.rows.set(key, { version, result, model });
  }
}

class MemoryLimiter implements RateLimiter {
  counts = new Map<string, number>();
  fail = false;
  async consume(bucket: string, w: Date, limit: number) {
    if (this.fail) throw new Error("db down");
    const k = `${bucket}@${w.toISOString()}`;
    const n = this.counts.get(k) ?? 0;
    if (n >= limit) return false;
    this.counts.set(k, n + 1);
    return true;
  }
}

function deps(over: Partial<LookupDeps> = {}): LookupDeps {
  return {
    provider: provider(),
    cache: new MemoryCache(),
    limiter: new MemoryLimiter(),
    limits: { perIpPerHour: 2, aiPerDay: 3 },
    ipHash: "abc",
    now: new Date("2026-11-04T10:30:00Z"),
    version: 1,
    log: () => {},
    ...over,
  };
}

describe("lookupCached", () => {
  it("asks the AI on a miss, stores the result, and serves the next call from cache", async () => {
    const d = deps();
    const first = await lookupCached(query, d);
    expect(first).toMatchObject({ ok: true, cached: false });
    const cache = d.cache as MemoryCache;
    expect(cache.rows.get("happy")?.model).toBe("groq:m1");
    const second = await lookupCached(query, d);
    expect(second).toMatchObject({ ok: true, cached: true });
    expect((d.provider as ReturnType<typeof provider>).calls).toBe(1);
  });

  it("ignores cached results from another version", async () => {
    const d = deps();
    await lookupCached(query, d);
    const again = await lookupCached(query, { ...d, version: 2 });
    expect(again.cached).toBe(false);
    expect((d.provider as ReturnType<typeof provider>).calls).toBe(2);
  });

  it("does not cache failures", async () => {
    const d = deps({ provider: provider('{"found": false}') });
    expect(await lookupCached(query, d)).toMatchObject({ ok: false, error: "not_found" });
    expect((d.cache as MemoryCache).rows.size).toBe(0);
  });

  it("limits AI calls per IP per hour, but not cache hits", async () => {
    const d = deps({ limits: { perIpPerHour: 2, aiPerDay: 100 } });
    const q = (t: string) => (parseQuery(t) as { ok: true; query: ParsedQuery }).query;
    expect((await lookupCached(q("one"), d)).ok).toBe(true);
    expect((await lookupCached(q("two"), d)).ok).toBe(true);
    expect(await lookupCached(q("three"), d)).toMatchObject({ ok: false, error: "rate_limited" });
    // cached ones still work
    expect(await lookupCached(q("one"), d)).toMatchObject({ ok: true, cached: true });
    // another IP is fine; next hour is fine
    expect((await lookupCached(q("three"), { ...d, ipHash: "other" })).ok).toBe(true);
    expect((await lookupCached(q("four"), { ...d, now: new Date("2026-11-04T11:00:00Z") })).ok).toBe(true);
  });

  it("enforces the site-wide daily limit across IPs", async () => {
    const d = deps({ limits: { perIpPerHour: 100, aiPerDay: 2 } });
    const q = (t: string) => (parseQuery(t) as { ok: true; query: ParsedQuery }).query;
    expect((await lookupCached(q("a"), { ...d, ipHash: "1" })).ok).toBe(true);
    expect((await lookupCached(q("b"), { ...d, ipHash: "2" })).ok).toBe(true);
    expect(await lookupCached(q("c"), { ...d, ipHash: "3" })).toMatchObject({ ok: false, error: "rate_limited" });
  });

  it("keeps working when Supabase is down (fail open) and logs it", async () => {
    const logs: string[] = [];
    const cache = new MemoryCache();
    const limiter = new MemoryLimiter();
    cache.fail = true;
    limiter.fail = true;
    const r = await lookupCached(query, deps({ cache, limiter, log: (m) => logs.push(m) }));
    expect(r.ok).toBe(true);
    expect(logs.join("\n")).toMatch(/\[cache\].*\n.*\[rate-limit\].*\n.*\[cache\]/);
  });

  it("works without Supabase at all", async () => {
    const r = await lookupCached(query, deps({ cache: null, limiter: null }));
    expect(r).toMatchObject({ ok: true, cached: false });
  });

  it("returns not_configured without an AI provider, after the cache", async () => {
    const d = deps();
    await lookupCached(query, d);
    expect(await lookupCached(query, { ...d, provider: null })).toMatchObject({ ok: true, cached: true });
    const other = (parseQuery("sad") as { ok: true; query: ParsedQuery }).query;
    expect(await lookupCached(other, { ...d, provider: null })).toMatchObject({ ok: false, error: "not_configured" });
  });
});
