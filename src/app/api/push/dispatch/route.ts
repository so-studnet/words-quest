import webpush from "web-push";
import { providerFromEnv } from "@/lib/ai/groq";
import { RESULT_VERSION } from "@/lib/domain/lookup-result";
import { dispatchWordOfTheDay, safeEqual, type DuePushRow } from "@/lib/domain/push";
import { parseQuery } from "@/lib/domain/query";
import { DEFAULT_LIMITS } from "@/lib/domain/rate-limit";
import { wordOfTheDay } from "@/lib/domain/word-of-the-day";
import { lookupCached } from "@/lib/lookup";
import { SupabaseLookupCache, supabaseFromEnv } from "@/lib/supabase/server";

/**
 * Sends the Word of the Day to devices whose notification hour has come.
 * Called hourly by Supabase pg_cron (supabase/cron/word-of-the-day.sql) with
 * Authorization: Bearer <CRON_SECRET>.
 */
export async function POST(request: Request) {
  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    CRON_SECRET: process.env.CRON_SECRET,
  };
  const missing = Object.entries(env)
    .filter(([, v]) => !v?.trim())
    .map(([k]) => k);
  if (missing.length > 0) {
    return Response.json({ error: "not configured", missing }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!safeEqual(token, env.CRON_SECRET!.trim())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseFromEnv()!;
  const vapidDetails = {
    subject: env.VAPID_SUBJECT!.trim(),
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
    privateKey: env.VAPID_PRIVATE_KEY!.trim(),
  };

  try {
    const result = await dispatchWordOfTheDay({
      claim: async () => {
        const { data, error } = await db.rpc("claim_word_of_the_day_push");
        if (error) throw new Error(error.message);
        return (data ?? []) as DuePushRow[];
      },
      wordFor: async (date) => {
        const word = wordOfTheDay(date);
        const parsed = parseQuery(word);
        if (!parsed.ok) return { word, result: null };
        // Cached after the first device, so the AI is asked at most once a day.
        const outcome = await lookupCached(parsed.query, {
          provider: providerFromEnv(),
          cache: new SupabaseLookupCache(db),
          limiter: null,
          limits: DEFAULT_LIMITS,
          ipHash: "cron",
          now: new Date(),
          version: RESULT_VERSION,
        });
        if (!outcome.ok) console.warn(`[push] lookup for ${word} failed: ${outcome.error}`);
        return { word, result: outcome.ok ? outcome.result : null };
      },
      send: async (target, payload) => {
        await webpush.sendNotification(target, JSON.stringify(payload), { vapidDetails, TTL: 6 * 60 * 60 });
      },
      removeSubscription: async (endpoint) => {
        const { error } = await db.rpc("delete_push_subscription", { target_endpoint: endpoint });
        if (error) console.error(`[push] remove failed: ${error.message}`);
      },
      log: (m) => console.error(m),
    });
    return Response.json(result);
  } catch (e) {
    console.error("[push] dispatch failed", e);
    return Response.json({ error: "dispatch failed" }, { status: 500 });
  }
}
