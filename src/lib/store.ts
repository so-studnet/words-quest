/** Where cached results and rate-limit counters live (Supabase in production). */
import type { LookupResult } from "@/lib/domain/lookup-result";

export interface LookupCache {
  /** The cached result for `key` made by `version`, or null. */
  get(key: string, version: number): Promise<LookupResult | null>;
  put(key: string, version: number, result: LookupResult, model: string): Promise<void>;
}

export interface RateLimiter {
  /** Count one use; false when `limit` is already reached in this window. */
  consume(bucket: string, windowStart: Date, limit: number): Promise<boolean>;
}
