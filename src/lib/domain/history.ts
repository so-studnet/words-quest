/**
 * Search history kept in the browser. Pure functions; the store is in lib/history-store.ts.
 */
import { parseQuery, type QueryKind } from "./query";

export const MAX_HISTORY = 50;

export type HistoryEntry = {
  text: string;
  kind: QueryKind;
  /** ISO 8601 (UTC) */
  at: string;
};

const KINDS: readonly QueryKind[] = ["word", "phrase", "sentence"];

/** Put `entry` first, removing any older entry with the same lowercase text, and cap the list. */
export function addEntry(list: readonly HistoryEntry[], entry: HistoryEntry, max = MAX_HISTORY): HistoryEntry[] {
  const key = entry.text.toLowerCase();
  return [entry, ...list.filter((e) => e.text.toLowerCase() !== key)].slice(0, max);
}

export function removeEntry(list: readonly HistoryEntry[], text: string): HistoryEntry[] {
  const key = text.toLowerCase();
  return list.filter((e) => e.text.toLowerCase() !== key);
}

/** Restore history from stored JSON, dropping broken entries one by one. */
export function parseHistory(data: unknown): HistoryEntry[] {
  if (!Array.isArray(data)) return [];
  let out: HistoryEntry[] = [];
  // Oldest first so that duplicates keep the newest position.
  for (const item of [...data].reverse()) {
    if (typeof item !== "object" || item === null) continue;
    const { text, kind, at } = item as Record<string, unknown>;
    if (typeof text !== "string" || typeof at !== "string" || Number.isNaN(Date.parse(at))) continue;
    if (!parseQuery(text).ok) continue;
    const k = KINDS.includes(kind as QueryKind) ? (kind as QueryKind) : "word";
    out = addEntry(out, { text, kind: k, at });
  }
  return out;
}
