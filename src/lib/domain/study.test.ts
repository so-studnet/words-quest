import { describe, expect, it } from "vitest";
import type { LookupResult } from "./lookup-result";
import {
  addDays,
  attachResult,
  dailySummary,
  daysBetween,
  dueItems,
  EMPTY_STUDY,
  importHistory,
  initialSchedule,
  localDate,
  logByDay,
  MASTERED_STAGE,
  nextSchedule,
  recordReview,
  recordSearch,
  removeItem,
  streak,
  studyStats,
  type StudyData,
  type StudyItem,
} from "./study";

function ids() {
  let n = 0;
  return () => `id${++n}`;
}

function result(query: string, kind: LookupResult["kind"] = "word"): LookupResult {
  return {
    query,
    kind,
    phonetic: null,
    paraphrase: null,
    senses: [{ partOfSpeech: null, definition: "d", examples: [], synonyms: [], antonyms: [] }],
    synonyms: [],
    antonyms: [],
    notes: [],
    source: "ai",
  };
}

// 2026-11-04 10:00 JST
const NOV4 = new Date("2026-11-04T01:00:00Z");

describe("dates", () => {
  it("uses the Japan calendar day", () => {
    expect(localDate("2026-11-03T14:59:59Z")).toBe("2026-11-03"); // 23:59 JST
    expect(localDate("2026-11-03T15:00:00Z")).toBe("2026-11-04"); // 00:00 JST
  });
  it("adds days across months and years", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-11-04", "2026-12-04")).toBe(30);
  });
});

describe("schedule", () => {
  it("reviews a new item the next day", () => {
    expect(initialSchedule("2026-11-04")).toEqual({ stage: 0, dueOn: "2026-11-05" });
  });
  it("follows 1 -> 3 -> 7 -> 14 -> 30 -> 60 days, then mastered", () => {
    let s = initialSchedule("2026-11-04");
    const gaps: number[] = [];
    let day = "2026-11-04";
    while (s.dueOn) {
      gaps.push(daysBetween(day, s.dueOn));
      day = s.dueOn;
      s = nextSchedule(s.stage, true, day);
    }
    expect(gaps).toEqual([1, 3, 7, 14, 30, 60]);
    expect(s).toEqual({ stage: MASTERED_STAGE, dueOn: null });
  });
  it("starts over tomorrow when forgotten", () => {
    expect(nextSchedule(4, false, "2026-11-10")).toEqual({ stage: 0, dueOn: "2026-11-11" });
  });
  it("counts a late review from the review day", () => {
    expect(nextSchedule(0, true, "2026-11-20")).toEqual({ stage: 1, dueOn: "2026-11-23" });
  });
  it("keeps a mastered item mastered", () => {
    expect(nextSchedule(MASTERED_STAGE, true, "2026-11-20")).toEqual({ stage: MASTERED_STAGE, dueOn: null });
  });
});

describe("dueItems", () => {
  const item = (id: string, dueOn: string | null, createdAt = "2026-11-01T00:00:00Z"): StudyItem => ({
    id, key: id, text: id, kind: "word", result: null, stage: 0, dueOn, createdAt,
  });
  it("returns due and overdue items, oldest due first, skipping future and mastered", () => {
    const items = [item("a", "2026-11-05"), item("b", "2026-11-03"), item("c", "2026-11-04"), item("d", null), item("e", "2026-11-04", "2026-10-01T00:00:00Z")];
    expect(dueItems(items, "2026-11-04").map((i) => i.id)).toEqual(["b", "e", "c"]);
  });
});

describe("recordSearch", () => {
  it("creates an item due tomorrow and a search event", () => {
    const c = recordSearch(EMPTY_STUDY, result("Serendipity"), NOV4, ids());
    expect(c.insertItems).toEqual([
      expect.objectContaining({ id: "id1", key: "serendipity", text: "Serendipity", stage: 0, dueOn: "2026-11-05" }),
    ]);
    expect(c.insertEvents).toEqual([{ id: "id2", itemId: "id1", type: "search", at: NOV4.toISOString() }]);
    expect(c.data.items).toHaveLength(1);
  });
  it("keeps the schedule of a known item but refreshes its result", () => {
    const first = recordSearch(EMPTY_STUDY, result("happy"), NOV4, ids());
    const reviewed = recordReview(first.data, "id1", true, new Date("2026-11-05T01:00:00Z"), () => "r1");
    const again = recordSearch(reviewed.data, result("Happy"), new Date("2026-11-06T01:00:00Z"), () => "x");
    expect(again.insertItems).toEqual([]);
    expect(again.updateItems[0]).toMatchObject({ id: "id1", text: "Happy", stage: 1, dueOn: "2026-11-08" });
    expect(again.data.events.filter((e) => e.type === "search")).toHaveLength(2);
  });
  it("does not change the input", () => {
    const before = structuredClone(EMPTY_STUDY);
    recordSearch(EMPTY_STUDY, result("a"), NOV4, ids());
    expect(EMPTY_STUDY).toEqual(before);
  });
});

describe("recordReview", () => {
  it("logs ok / ng events and reschedules", () => {
    const d = recordSearch(EMPTY_STUDY, result("happy"), NOV4, ids()).data;
    const ok = recordReview(d, "id1", true, new Date("2026-11-05T01:00:00Z"), () => "e");
    expect(ok.updateItems[0]).toMatchObject({ stage: 1, dueOn: "2026-11-08" });
    expect(ok.insertEvents[0]).toMatchObject({ type: "review_ok", itemId: "id1" });
    const ng = recordReview(ok.data, "id1", false, new Date("2026-11-08T01:00:00Z"), () => "f");
    expect(ng.updateItems[0]).toMatchObject({ stage: 0, dueOn: "2026-11-09" });
    expect(ng.insertEvents[0].type).toBe("review_ng");
  });
  it("ignores unknown items", () => {
    const c = recordReview(EMPTY_STUDY, "nope", true, NOV4, ids());
    expect(c.updateItems).toEqual([]);
    expect(c.insertEvents).toEqual([]);
  });
});

describe("attachResult / removeItem", () => {
  it("attaches a result and removes an item with its events", () => {
    const d = recordSearch(EMPTY_STUDY, result("happy"), NOV4, ids()).data;
    const noResult: StudyData = { ...d, items: d.items.map((i) => ({ ...i, result: null })) };
    expect(attachResult(noResult, "id1", result("happy")).updateItems[0].result?.query).toBe("happy");
    expect(removeItem(d, "id1")).toEqual(EMPTY_STUDY);
  });
});

describe("importHistory", () => {
  it("adds history entries as items learned on their day, skipping known and invalid ones", () => {
    const known = recordSearch(EMPTY_STUDY, result("happy"), NOV4, () => "k").data;
    const c = importHistory(
      known,
      [
        { text: "break the ice", kind: "phrase", at: "2026-11-02T14:00:00Z" }, // Nov 2, 23:00 JST
        { text: "HAPPY", kind: "word", at: "2026-11-01T00:00:00Z" },
        { text: "日本語", kind: "word", at: "2026-11-01T00:00:00Z" },
        { text: "serendipity", kind: "word", at: "2026-11-01T00:00:00Z" },
      ],
      ids(),
    );
    expect(c.insertItems.map((i) => [i.key, i.dueOn, i.result])).toEqual([
      ["serendipity", "2026-11-02", null],
      ["break the ice", "2026-11-03", null],
    ]);
    expect(c.insertEvents.map((e) => e.at)).toEqual(["2026-11-01T00:00:00Z", "2026-11-02T14:00:00Z"]);
  });
});

describe("summaries", () => {
  // Nov 3: learn a, b. Nov 4: learn c, search a again, review b.
  function sample() {
    const id = ids();
    let d = recordSearch(EMPTY_STUDY, result("a"), new Date("2026-11-03T01:00:00Z"), id).data;
    d = recordSearch(d, result("b"), new Date("2026-11-03T02:00:00Z"), id).data;
    d = recordSearch(d, result("c"), new Date("2026-11-04T01:00:00Z"), id).data;
    d = recordSearch(d, result("a"), new Date("2026-11-04T02:00:00Z"), id).data;
    d = recordReview(d, d.items[1].id, true, new Date("2026-11-04T03:00:00Z"), id).data;
    return d;
  }

  it("counts learned and reviewed per day", () => {
    expect(dailySummary(sample(), "2026-11-04", 3)).toEqual([
      { date: "2026-11-02", learned: 0, reviewed: 0 },
      { date: "2026-11-03", learned: 2, reviewed: 0 },
      { date: "2026-11-04", learned: 1, reviewed: 1 },
    ]);
  });

  it("lists each day's lookups once, newest day first, marking new items", () => {
    const log = logByDay(sample());
    expect(log.map((d) => [d.date, d.items.map((x) => `${x.item.key}${x.isNew ? "*" : ""}`)])).toEqual([
      ["2026-11-04", ["c*", "a"]],
      ["2026-11-03", ["a*", "b*"]],
    ]);
  });

  it("counts the streak back from today, or from yesterday if today is empty", () => {
    const d = sample();
    expect(streak(d, "2026-11-04")).toBe(2);
    expect(streak(d, "2026-11-05")).toBe(2);
    expect(streak(d, "2026-11-06")).toBe(0);
    expect(streak(EMPTY_STUDY, "2026-11-04")).toBe(0);
  });

  it("summarizes today", () => {
    expect(studyStats(sample(), "2026-11-04")).toEqual({
      learnedToday: 1,
      reviewedToday: 1,
      dueToday: 1, // a (due Nov 4); b moved to Nov 7; c due Nov 5
      streak: 2,
      total: 3,
      mastered: 0,
    });
  });
});
