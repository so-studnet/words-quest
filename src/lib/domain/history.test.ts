import { describe, expect, it } from "vitest";
import { addEntry, MAX_HISTORY, parseHistory, removeEntry, type HistoryEntry } from "./history";

const e = (text: string, at = "2026-11-04T00:00:00.000Z"): HistoryEntry => ({ text, kind: "word", at });

describe("addEntry", () => {
  it("adds to the front", () => {
    expect(addEntry([e("a")], e("b")).map((x) => x.text)).toEqual(["b", "a"]);
  });
  it("moves a repeated search to the front, ignoring case", () => {
    const list = [e("one"), e("Two"), e("three")];
    expect(addEntry(list, e("two")).map((x) => x.text)).toEqual(["two", "one", "three"]);
  });
  it("keeps at most MAX_HISTORY entries", () => {
    let list: HistoryEntry[] = [];
    for (let i = 0; i < MAX_HISTORY + 5; i++) list = addEntry(list, e(`w${i}`));
    expect(list).toHaveLength(MAX_HISTORY);
    expect(list[0].text).toBe(`w${MAX_HISTORY + 4}`);
  });
  it("does not change the original array", () => {
    const list = [e("a")];
    addEntry(list, e("b"));
    expect(list).toEqual([e("a")]);
  });
});

describe("removeEntry", () => {
  it("removes ignoring case", () => {
    expect(removeEntry([e("Apple"), e("pear")], "apple").map((x) => x.text)).toEqual(["pear"]);
  });
});

describe("parseHistory", () => {
  it("restores valid entries in order", () => {
    const data = [e("new"), { text: "break the ice", kind: "phrase", at: "2026-11-03T00:00:00Z" }];
    expect(parseHistory(data)).toEqual([e("new"), { text: "break the ice", kind: "phrase", at: "2026-11-03T00:00:00Z" }]);
  });
  it("drops broken entries and keeps the rest", () => {
    const data = [null, 3, { text: 1 }, { text: "ok", at: "not a date" }, { text: "日本語", kind: "word", at: "2026-11-04T00:00:00Z" }, e("good")];
    expect(parseHistory(data).map((x) => x.text)).toEqual(["good"]);
  });
  it("defaults an unknown kind to word", () => {
    expect(parseHistory([{ text: "x", kind: "??", at: "2026-11-04T00:00:00Z" }])[0].kind).toBe("word");
  });
  it("removes duplicates, keeping the first (newest)", () => {
    expect(parseHistory([e("A", "2026-11-04T00:00:00Z"), e("a", "2026-11-01T00:00:00Z")])).toEqual([e("A", "2026-11-04T00:00:00Z")]);
  });
  it("returns [] for non-arrays", () => {
    expect(parseHistory({})).toEqual([]);
    expect(parseHistory(null)).toEqual([]);
  });
});
