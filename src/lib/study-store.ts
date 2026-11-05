"use client";

import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { subscribeAuth, getAuthState } from "@/lib/auth";
import { parseHistory } from "@/lib/domain/history";
import type { LookupResult } from "@/lib/domain/lookup-result";
import {
  attachResult,
  EMPTY_STUDY,
  importHistory,
  recordReview,
  recordSearch,
  removeItem,
  type StudyChange,
  type StudyData,
  type StudyEvent,
  type StudyItem,
} from "@/lib/domain/study";
import {
  eventToRow,
  itemToRow,
  rowToEvent,
  rowToItem,
  type StudyEventRow,
  type StudyItemRow,
} from "@/lib/domain/study-rows";
import { HISTORY_KEY } from "@/lib/history-store";
import { newId } from "@/lib/ids";
import { getBrowserSupabase } from "@/lib/supabase/client";

export type StudyState =
  | { status: "off"; data: StudyData } // signed out / not configured
  | { status: "loading"; data: StudyData }
  | { status: "ready"; data: StudyData; saving: boolean }
  | { status: "error"; data: StudyData; message: string };

const OFF: StudyState = { status: "off", data: EMPTY_STUDY };
const PAGE = 1000;
const importedKey = (userId: string) => `wq:history-imported:${userId}`;

let state: StudyState = OFF;
let userId: string | null = null;
let generation = 0; // bumps on user change so stale loads are ignored
let queue: Promise<void> = Promise.resolve();
let pending = 0;
const listeners = new Set<() => void>();

function set(next: StudyState) {
  state = next;
  listeners.forEach((l) => l());
}

async function loadAll<T>(db: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(columns).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

async function load() {
  const gen = generation;
  const db = getBrowserSupabase();
  set({ status: "loading", data: state.data });
  try {
    const [itemRows, eventRows] = await Promise.all([
      loadAll<StudyItemRow>(db, "study_items", "id, key, text, kind, result, stage, due_on, created_at"),
      loadAll<StudyEventRow>(db, "study_events", "id, item_id, type, at"),
    ]);
    if (gen !== generation) return;
    const items = itemRows.map(rowToItem).filter((i): i is StudyItem => i !== null);
    const ids = new Set(items.map((i) => i.id));
    const events = eventRows.map(rowToEvent).filter((e): e is StudyEvent => e !== null && ids.has(e.itemId));
    set({ status: "ready", data: { items, events }, saving: false });
    importBrowserHistoryOnce();
  } catch (e) {
    if (gen !== generation) return;
    set({ status: "error", data: state.data, message: "Could not load your study log." });
    console.error("[study] load failed", e);
  }
}

/** Send a change after the previous ones, in order: items first, then events. */
function send(change: StudyChange) {
  const gen = generation;
  pending++;
  if (state.status === "ready") set({ ...state, saving: true });
  queue = queue.then(async () => {
    if (gen !== generation) return;
    const db = getBrowserSupabase();
    const items = [...change.insertItems, ...change.updateItems].map(itemToRow);
    try {
      if (items.length) {
        const { error } = await db.from("study_items").upsert(items);
        if (error) throw new Error(error.message);
      }
      if (change.insertEvents.length) {
        const { error } = await db.from("study_events").insert(change.insertEvents.map(eventToRow));
        if (error) throw new Error(error.message);
      }
    } catch (e) {
      console.error("[study] save failed", e);
      if (gen === generation) {
        set({ status: "error", data: state.data, message: "Could not save. Reloading your study log…" });
        await load(); // server state wins
      }
    } finally {
      pending--;
      if (gen === generation && pending === 0 && state.status === "ready") set({ ...state, saving: false });
    }
  });
}

function apply(fn: (d: StudyData) => StudyChange) {
  if (state.status !== "ready") return;
  const change = fn(state.data);
  if (!change.insertItems.length && !change.updateItems.length && !change.insertEvents.length) return;
  set({ ...state, data: change.data });
  send(change);
}

function importBrowserHistoryOnce() {
  if (!userId) return;
  const flag = importedKey(userId);
  let entries;
  try {
    if (window.localStorage.getItem(flag)) return;
    entries = parseHistory(JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]"));
    window.localStorage.setItem(flag, new Date().toISOString());
  } catch {
    return;
  }
  if (entries.length) apply((d) => importHistory(d, entries, newId));
}

function onAuthChange() {
  const auth = getAuthState();
  const next = auth.status === "signed-in" ? auth.userId : null;
  if (next === userId) return;
  userId = next;
  generation++;
  pending = 0;
  queue = Promise.resolve();
  if (next) void load();
  else set(OFF);
}

let started = false;
function subscribe(onChange: () => void) {
  if (!started && typeof window !== "undefined") {
    started = true;
    subscribeAuth(onAuthChange);
    onAuthChange();
  }
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useStudy(): StudyState {
  return useSyncExternalStore(subscribe, () => state, () => OFF);
}

export const study = {
  /** Called after every successful lookup; does nothing when signed out. */
  recordSearch(result: LookupResult) {
    apply((d) => recordSearch(d, result, new Date(), newId));
  },
  review(itemId: string, remembered: boolean) {
    apply((d) => recordReview(d, itemId, remembered, new Date(), newId));
  },
  attachResult(itemId: string, result: LookupResult) {
    apply((d) => attachResult(d, itemId, result));
  },
  remove(itemId: string) {
    if (state.status !== "ready") return;
    const gen = generation;
    set({ ...state, data: removeItem(state.data, itemId) });
    queue = queue.then(async () => {
      if (gen !== generation) return;
      const { error } = await getBrowserSupabase().from("study_items").delete().eq("id", itemId);
      if (error && gen === generation) {
        console.error("[study] delete failed", error);
        await load();
      }
    });
  },
  reload() {
    if (userId) void load();
  },
};
