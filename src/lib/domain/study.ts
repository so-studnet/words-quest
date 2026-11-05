/**
 * Study log and spaced review (pure). Dates are local calendar days ("YYYY-MM-DD")
 * in the study time zone; timestamps are ISO 8601 UTC.
 */
import type { HistoryEntry } from "./history";
import type { LookupResult } from "./lookup-result";
import { parseQuery, type QueryKind } from "./query";

export const STUDY_TIME_ZONE = "Asia/Tokyo";

/** Days until the next review after each successful step. After the last one the item is mastered. */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60] as const;
export const MASTERED_STAGE = REVIEW_INTERVALS.length;

export type StudyItem = {
  id: string;
  /** Lowercased query (same as the cache key); unique per user. */
  key: string;
  text: string;
  kind: QueryKind;
  /** Snapshot of the lookup, shown when reviewing. null for items imported from history. */
  result: LookupResult | null;
  /** 0..MASTERED_STAGE: how many reviews in a row were remembered. */
  stage: number;
  /** Next review day; null once mastered. */
  dueOn: string | null;
  createdAt: string;
};

export type StudyEventType = "search" | "review_ok" | "review_ng";

export type StudyEvent = {
  id: string;
  itemId: string;
  type: StudyEventType;
  at: string;
};

export type StudyData = { items: StudyItem[]; events: StudyEvent[] };
export const EMPTY_STUDY: StudyData = { items: [], events: [] };

// ---------- dates ----------

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar day of `at` in `timeZone`, as YYYY-MM-DD. */
export function localDate(at: string | Date, timeZone: string = STUDY_TIME_ZONE): string {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatters.set(timeZone, f);
  }
  return f.format(typeof at === "string" ? new Date(at) : at);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

// ---------- schedule ----------

export type Schedule = { stage: number; dueOn: string | null };

/** A newly learned item is first reviewed the next day. */
export function initialSchedule(learnedOn: string): Schedule {
  return { stage: 0, dueOn: addDays(learnedOn, REVIEW_INTERVALS[0]) };
}

/**
 * After a review on `today`: remembered moves one step further (or masters the item);
 * forgotten starts over with a review tomorrow. Late reviews count from `today`.
 */
export function nextSchedule(stage: number, remembered: boolean, today: string): Schedule {
  if (!remembered) return { stage: 0, dueOn: addDays(today, REVIEW_INTERVALS[0]) };
  const next = Math.min(stage + 1, MASTERED_STAGE);
  if (next >= MASTERED_STAGE) return { stage: MASTERED_STAGE, dueOn: null };
  return { stage: next, dueOn: addDays(today, REVIEW_INTERVALS[next]) };
}

/** Items to review today (due today or overdue), oldest due first. */
export function dueItems(items: readonly StudyItem[], today: string): StudyItem[] {
  return items
    .filter((i) => i.dueOn !== null && i.dueOn <= today)
    .sort((a, b) => (a.dueOn! < b.dueOn! ? -1 : a.dueOn! > b.dueOn! ? 1 : a.createdAt < b.createdAt ? -1 : 1));
}

// ---------- changes ----------

export type NewId = () => string;

export type StudyChange = {
  data: StudyData;
  /** Rows to send to the server. */
  insertItems: StudyItem[];
  updateItems: StudyItem[];
  insertEvents: StudyEvent[];
};

const noChange = (data: StudyData): StudyChange => ({ data, insertItems: [], updateItems: [], insertEvents: [] });

/**
 * Log a successful search. A new key becomes a new item (first review tomorrow);
 * a known key keeps its schedule but gets a fresh result snapshot. Always adds a search event.
 */
export function recordSearch(data: StudyData, result: LookupResult, now: Date, newId: NewId): StudyChange {
  const key = result.query.toLowerCase();
  const at = now.toISOString();
  const existing = data.items.find((i) => i.key === key);
  if (existing) {
    const updated: StudyItem = { ...existing, result, text: result.query, kind: result.kind };
    const event: StudyEvent = { id: newId(), itemId: existing.id, type: "search", at };
    return {
      data: { items: data.items.map((i) => (i.id === existing.id ? updated : i)), events: [...data.events, event] },
      insertItems: [],
      updateItems: [updated],
      insertEvents: [event],
    };
  }
  const item: StudyItem = {
    id: newId(),
    key,
    text: result.query,
    kind: result.kind,
    result,
    ...initialSchedule(localDate(now)),
    createdAt: at,
  };
  const event: StudyEvent = { id: newId(), itemId: item.id, type: "search", at };
  return {
    data: { items: [...data.items, item], events: [...data.events, event] },
    insertItems: [item],
    updateItems: [],
    insertEvents: [event],
  };
}

/** Grade a review of `itemId` on `now`. Unknown ids change nothing. */
export function recordReview(data: StudyData, itemId: string, remembered: boolean, now: Date, newId: NewId): StudyChange {
  const item = data.items.find((i) => i.id === itemId);
  if (!item) return noChange(data);
  const updated: StudyItem = { ...item, ...nextSchedule(item.stage, remembered, localDate(now)) };
  const event: StudyEvent = { id: newId(), itemId, type: remembered ? "review_ok" : "review_ng", at: now.toISOString() };
  return {
    data: { items: data.items.map((i) => (i.id === itemId ? updated : i)), events: [...data.events, event] },
    insertItems: [],
    updateItems: [updated],
    insertEvents: [event],
  };
}

/** Store a fetched result on an item that had none (imported from history). */
export function attachResult(data: StudyData, itemId: string, result: LookupResult): StudyChange {
  const item = data.items.find((i) => i.id === itemId);
  if (!item) return noChange(data);
  const updated = { ...item, result };
  return { ...noChange({ ...data, items: data.items.map((i) => (i.id === itemId ? updated : i)) }), updateItems: [updated] };
}

export function removeItem(data: StudyData, itemId: string): StudyData {
  return { items: data.items.filter((i) => i.id !== itemId), events: data.events.filter((e) => e.itemId !== itemId) };
}

/**
 * Bring browser search history into the log, once. Entries whose key is already
 * logged are skipped. Each becomes an item learned on the day it was searched.
 */
export function importHistory(data: StudyData, entries: readonly HistoryEntry[], newId: NewId): StudyChange {
  const known = new Set(data.items.map((i) => i.key));
  const insertItems: StudyItem[] = [];
  const insertEvents: StudyEvent[] = [];
  // Oldest first, so created order matches search order.
  for (const e of [...entries].sort((a, b) => (a.at < b.at ? -1 : 1))) {
    const parsed = parseQuery(e.text);
    if (!parsed.ok || known.has(parsed.query.key)) continue;
    known.add(parsed.query.key);
    const item: StudyItem = {
      id: newId(),
      key: parsed.query.key,
      text: parsed.query.text,
      kind: parsed.query.kind,
      result: null,
      ...initialSchedule(localDate(e.at)),
      createdAt: e.at,
    };
    insertItems.push(item);
    insertEvents.push({ id: newId(), itemId: item.id, type: "search", at: e.at });
  }
  return {
    data: { items: [...data.items, ...insertItems], events: [...data.events, ...insertEvents] },
    insertItems,
    updateItems: [],
    insertEvents,
  };
}

// ---------- summaries ----------

export type DaySummary = { date: string; learned: number; reviewed: number };

/** One entry per day for the `days` days ending today (oldest first). */
export function dailySummary(data: StudyData, today: string, days: number): DaySummary[] {
  const start = addDays(today, -(days - 1));
  const out = new Map<string, DaySummary>();
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    out.set(date, { date, learned: 0, reviewed: 0 });
  }
  for (const item of data.items) {
    const d = out.get(localDate(item.createdAt));
    if (d) d.learned++;
  }
  for (const e of data.events) {
    if (e.type === "search") continue;
    const d = out.get(localDate(e.at));
    if (d) d.reviewed++;
  }
  return [...out.values()];
}

export type DayLog = { date: string; items: { item: StudyItem; isNew: boolean }[] };

/**
 * What was looked up on each day, newest day first. Each item appears once per day,
 * in the order first searched that day. `isNew` marks the day it was first learned.
 */
export function logByDay(data: StudyData): DayLog[] {
  const byId = new Map(data.items.map((i) => [i.id, i]));
  const days = new Map<string, Map<string, StudyItem>>();
  const searches = data.events.filter((e) => e.type === "search").sort((a, b) => (a.at < b.at ? -1 : 1));
  for (const e of searches) {
    const item = byId.get(e.itemId);
    if (!item) continue;
    const date = localDate(e.at);
    let day = days.get(date);
    if (!day) days.set(date, (day = new Map()));
    if (!day.has(item.id)) day.set(item.id, item);
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, items]) => ({
      date,
      items: [...items.values()].map((item) => ({ item, isNew: localDate(item.createdAt) === date })),
    }));
}

/** Consecutive days with any study activity, ending today (or yesterday if nothing yet today). */
export function streak(data: StudyData, today: string): number {
  const active = new Set(data.events.map((e) => localDate(e.at)));
  let day = active.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (active.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export type StudyStats = {
  learnedToday: number;
  reviewedToday: number;
  dueToday: number;
  streak: number;
  total: number;
  mastered: number;
};

export function studyStats(data: StudyData, today: string): StudyStats {
  return {
    learnedToday: data.items.filter((i) => localDate(i.createdAt) === today).length,
    reviewedToday: data.events.filter((e) => e.type !== "search" && localDate(e.at) === today).length,
    dueToday: dueItems(data.items, today).length,
    streak: streak(data, today),
    total: data.items.length,
    mastered: data.items.filter((i) => i.stage >= MASTERED_STAGE).length,
  };
}
