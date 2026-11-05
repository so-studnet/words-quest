/** Convert between StudyData and Supabase rows (snake_case). Broken rows are dropped. */
import { isLookupResult } from "./lookup-result";
import { MASTERED_STAGE, type StudyEvent, type StudyEventType, type StudyItem } from "./study";

export type StudyItemRow = {
  id: string;
  key: string;
  text: string;
  kind: string;
  result: unknown;
  stage: number;
  due_on: string | null;
  created_at: string;
};

export type StudyEventRow = { id: string; item_id: string; type: string; at: string };

const KINDS = ["word", "phrase", "sentence"];
const EVENT_TYPES: StudyEventType[] = ["search", "review_ok", "review_ng"];

/** "2026-11-04 01:00:00+00" / "+00:00" -> "2026-11-04T01:00:00.000Z" */
export function normalizeTimestamp(v: string): string | null {
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function itemToRow(i: StudyItem): StudyItemRow {
  return {
    id: i.id,
    key: i.key,
    text: i.text,
    kind: i.kind,
    result: i.result,
    stage: i.stage,
    due_on: i.dueOn,
    created_at: i.createdAt,
  };
}

export function rowToItem(r: StudyItemRow): StudyItem | null {
  const createdAt = normalizeTimestamp(r.created_at);
  if (!createdAt || !KINDS.includes(r.kind) || !Number.isInteger(r.stage)) return null;
  if (r.stage < 0 || r.stage > MASTERED_STAGE) return null;
  if (r.due_on !== null && !/^\d{4}-\d{2}-\d{2}$/.test(r.due_on)) return null;
  return {
    id: r.id,
    key: r.key,
    text: r.text,
    kind: r.kind as StudyItem["kind"],
    result: isLookupResult(r.result) ? r.result : null,
    stage: r.stage,
    dueOn: r.due_on,
    createdAt,
  };
}

export function eventToRow(e: StudyEvent): StudyEventRow {
  return { id: e.id, item_id: e.itemId, type: e.type, at: e.at };
}

export function rowToEvent(r: StudyEventRow): StudyEvent | null {
  const at = normalizeTimestamp(r.at);
  if (!at || !EVENT_TYPES.includes(r.type as StudyEventType)) return null;
  return { id: r.id, itemId: r.item_id, type: r.type as StudyEventType, at };
}
