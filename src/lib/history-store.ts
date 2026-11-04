"use client";

import { useSyncExternalStore } from "react";
import { addEntry, parseHistory, removeEntry, type HistoryEntry } from "@/lib/domain/history";
import type { QueryKind } from "@/lib/domain/query";

export const HISTORY_KEY = "wq:history:v1";
const EMPTY: HistoryEntry[] = [];

const listeners = new Set<() => void>();
// useSyncExternalStore needs the same reference for the same value, so cache by the raw string.
let cachedRaw: string | null | undefined;
let cached: HistoryEntry[] = EMPTY;

function read(): HistoryEntry[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(HISTORY_KEY);
  } catch {
    return cached;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cached = raw === null ? EMPTY : parseHistory(JSON.parse(raw));
    } catch {
      cached = EMPTY;
    }
  }
  return cached;
}

function write(fn: (prev: HistoryEntry[]) => HistoryEntry[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(fn(read())));
  } catch {
    // Storage full or blocked (private mode): history is a convenience, so ignore.
  }
  listeners.forEach((l) => l());
}

function onStorage(e: StorageEvent) {
  if (e.key === HISTORY_KEY || e.key === null) listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export const history = {
  add(text: string, kind: QueryKind) {
    write((prev) => addEntry(prev, { text, kind, at: new Date().toISOString() }));
  },
  remove(text: string) {
    write((prev) => removeEntry(prev, text));
  },
  clear() {
    write(() => []);
  },
};
