/**
 * Random word / phrasal verb / idiom (pure). Only the entry is shown; looking it up is
 * an ordinary search, so nothing is logged until the user opens the search.
 */
import { RANDOM_SOURCE } from "./random-entries";

export type RandomKind = "word" | "phrasal verb" | "idiom";
export type Level = "B1" | "B2" | "C1" | "C2";
export type RandomEntry = { text: string; kind: RandomKind; level: Level };

export const KINDS: RandomKind[] = ["word", "phrasal verb", "idiom"];
export const LEVELS: Level[] = ["B1", "B2", "C1", "C2"];

export const RANDOM_ENTRIES: RandomEntry[] = KINDS.flatMap((kind) =>
  LEVELS.flatMap((level) =>
    (RANDOM_SOURCE[kind][level] ?? "")
      .split("|")
      .filter(Boolean)
      .map((text) => ({ text, kind, level })),
  ),
);

export type RandomFilter = { kind: RandomKind | "all"; level: Level | "all" };
export const ALL: RandomFilter = { kind: "all", level: "all" };

/** Read the filter from URL params; anything unknown means "all". */
export function parseRandomFilter(get: (name: string) => string | null): RandomFilter {
  const kind = get("kind");
  const level = get("level");
  return {
    kind: (KINDS as string[]).includes(kind ?? "") ? (kind as RandomKind) : "all",
    level: (LEVELS as string[]).includes(level ?? "") ? (level as Level) : "all",
  };
}

/** Entries matching the filter, without the ones already in the study log (by lowercase key). */
export function candidates(
  entries: readonly RandomEntry[],
  filter: RandomFilter,
  learnedKeys: ReadonlySet<string>,
): RandomEntry[] {
  return entries.filter(
    (e) =>
      (filter.kind === "all" || e.kind === filter.kind) &&
      (filter.level === "all" || e.level === filter.level) &&
      !learnedKeys.has(e.text.toLowerCase()),
  );
}

/** A random entry, avoiding `avoid` (the one on screen) when there is any other choice. */
export function pickRandom(
  list: readonly RandomEntry[],
  avoid?: string,
  rand: () => number = Math.random,
): RandomEntry | null {
  const pool = list.length > 1 && avoid ? list.filter((e) => e.text !== avoid) : list;
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}

export function findEntry(text: string): RandomEntry | null {
  const key = text.toLowerCase();
  return RANDOM_ENTRIES.find((e) => e.text.toLowerCase() === key) ?? null;
}

/** URL of the Random page for an entry and filter (default filter values are left out). */
export function randomHref(text: string | null, filter: RandomFilter): string {
  const p = new URLSearchParams();
  if (text) p.set("w", text);
  if (filter.kind !== "all") p.set("kind", filter.kind);
  if (filter.level !== "all") p.set("level", filter.level);
  const qs = p.toString();
  return qs ? `/random?${qs}` : "/random";
}
