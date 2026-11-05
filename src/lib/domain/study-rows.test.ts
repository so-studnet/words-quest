import { describe, expect, it } from "vitest";
import type { StudyItem } from "./study";
import { eventToRow, itemToRow, normalizeTimestamp, rowToEvent, rowToItem } from "./study-rows";

const item: StudyItem = {
  id: "i1",
  key: "happy",
  text: "Happy",
  kind: "word",
  result: null,
  stage: 2,
  dueOn: "2026-11-10",
  createdAt: "2026-11-04T01:00:00.000Z",
};

describe("study rows", () => {
  it("round-trips items and events", () => {
    expect(rowToItem(itemToRow(item))).toEqual(item);
    const e = { id: "e1", itemId: "i1", type: "review_ok" as const, at: "2026-11-04T01:00:00.000Z" };
    expect(rowToEvent(eventToRow(e))).toEqual(e);
  });
  it("normalizes Postgres timestamps", () => {
    expect(normalizeTimestamp("2026-11-04T01:00:00+00:00")).toBe("2026-11-04T01:00:00.000Z");
    expect(normalizeTimestamp("nope")).toBeNull();
    expect(rowToItem({ ...itemToRow(item), created_at: "2026-11-04T01:00:00+00:00" })?.createdAt).toBe(item.createdAt);
  });
  it("drops broken rows and invalid results", () => {
    expect(rowToItem({ ...itemToRow(item), kind: "poem" })).toBeNull();
    expect(rowToItem({ ...itemToRow(item), stage: 9 })).toBeNull();
    expect(rowToItem({ ...itemToRow(item), due_on: "tomorrow" })).toBeNull();
    expect(rowToItem({ ...itemToRow(item), result: { broken: true } })?.result).toBeNull();
    expect(rowToEvent({ id: "e", item_id: "i", type: "quiz", at: "2026-11-04T01:00:00Z" })).toBeNull();
  });
});
