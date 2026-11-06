/** Push notification content and dispatch (pure / dependency-injected). */
import type { LookupResult } from "./lookup-result";

export type PushPayload = { title: string; body: string; tag: string; url: string };

const MAX_BODY = 140;

/** "Word of the Day: serendipity" + the first definition. */
export function buildWordOfTheDayPayload(word: string, result: LookupResult | null, date: string): PushPayload {
  const definition = result?.senses[0]?.definition ?? result?.paraphrase ?? null;
  let body = definition ?? "Tap to see what it means.";
  if (body.length > MAX_BODY) body = `${body.slice(0, MAX_BODY - 1).trimEnd()}…`;
  return {
    title: `Word of the Day: ${word}`,
    body,
    tag: `wotd-${date}`,
    url: `/?q=${encodeURIComponent(word)}`,
  };
}

/** One row from claim_word_of_the_day_push(). */
export type DuePushRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  local_date: string;
};

export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };

export type DispatchDeps = {
  /** Subscriptions due now, already marked as sent for their local date. */
  claim: () => Promise<DuePushRow[]>;
  /** The word for a date and, if possible, its lookup (null when the lookup fails). */
  wordFor: (date: string) => Promise<{ word: string; result: LookupResult | null }>;
  /** Throws an error with `statusCode` on failure. */
  send: (target: PushTarget, payload: PushPayload) => Promise<void>;
  removeSubscription: (endpoint: string) => Promise<void>;
  log?: (msg: string) => void;
};

export type DispatchResult = { sent: number; failed: number; removed: number };

/** The push service says the subscription no longer exists. */
const GONE = new Set([404, 410]);

export async function dispatchWordOfTheDay(deps: DispatchDeps): Promise<DispatchResult> {
  const rows = await deps.claim();
  const result: DispatchResult = { sent: 0, failed: 0, removed: 0 };
  // Look each date up once, even with many devices.
  const words = new Map<string, Promise<{ word: string; result: LookupResult | null }>>();
  await Promise.all(
    rows.map(async (row) => {
      if (!words.has(row.local_date)) words.set(row.local_date, deps.wordFor(row.local_date));
      const { word, result: lookup } = await words.get(row.local_date)!;
      const payload = buildWordOfTheDayPayload(word, lookup, row.local_date);
      try {
        await deps.send({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload);
        result.sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status !== undefined && GONE.has(status)) {
          await deps.removeSubscription(row.endpoint);
          result.removed++;
        } else {
          deps.log?.(`[push] send failed (${status ?? "no status"}): ${String(e)}`);
          result.failed++;
        }
      }
    }),
  );
  return result;
}

/** Compare secrets in constant time. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
