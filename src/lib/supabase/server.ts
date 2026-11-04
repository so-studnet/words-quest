import "server-only";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isLookupResult } from "@/lib/domain/lookup-result";
import type { LookupCache, RateLimiter } from "@/lib/store";

/**
 * Server-only Supabase access with the Secret key (bypasses RLS).
 * Never import this from a Client Component.
 */
export function supabaseFromEnv(env: Record<string, string | undefined> = process.env): SupabaseClient | null {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export class SupabaseLookupCache implements LookupCache {
  constructor(private readonly db: SupabaseClient) {}

  async get(key: string, version: number) {
    const { data, error } = await this.db
      .from("lookups")
      .select("result, version")
      .eq("key", key)
      .maybeSingle();
    if (error) throw new Error(`cache get failed: ${error.message}`);
    if (!data || data.version !== version || !isLookupResult(data.result)) return null;
    // Hit counter is a nice-to-have; don't fail the request over it.
    void this.db.rpc("touch_lookup", { p_key: key }).then(
      ({ error: e }) => e && console.warn(`[cache] touch failed: ${e.message}`),
      () => {},
    );
    return data.result;
  }

  async put(key: string, version: number, result: unknown, model: string) {
    const kind = (result as { kind: string }).kind;
    const { error } = await this.db
      .from("lookups")
      .upsert({ key, version, kind, result, model, hits: 0, created_at: new Date().toISOString() });
    if (error) throw new Error(`cache put failed: ${error.message}`);
  }
}

export class SupabaseRateLimiter implements RateLimiter {
  constructor(private readonly db: SupabaseClient) {}

  async consume(bucket: string, windowStart: Date, limit: number) {
    const { data, error } = await this.db.rpc("consume_quota", {
      p_bucket: bucket,
      p_window_start: windowStart.toISOString(),
      p_limit: limit,
    });
    if (error) throw new Error(`rate limit failed: ${error.message}`);
    return data === true;
  }
}

/** IPs are stored only as a salted hash. */
export function hashIp(ip: string, salt = process.env.RATE_LIMIT_SALT || "words-quest"): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
