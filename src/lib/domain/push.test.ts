import { describe, expect, it } from "vitest";
import type { LookupResult } from "./lookup-result";
import { buildWordOfTheDayPayload, dispatchWordOfTheDay, safeEqual, type DuePushRow, type PushTarget } from "./push";

const result = (definition: string): LookupResult => ({
  query: "serendipity",
  kind: "word",
  phonetic: null,
  paraphrase: null,
  senses: [{ partOfSpeech: "noun", definition, examples: [], synonyms: [], antonyms: [] }],
  synonyms: [],
  antonyms: [],
  notes: [],
  source: "ai",
});

describe("buildWordOfTheDayPayload", () => {
  it("uses the first definition and links to the search", () => {
    expect(buildWordOfTheDayPayload("serendipity", result("Luck in finding good things."), "2026-11-06")).toEqual({
      title: "Word of the Day: serendipity",
      body: "Luck in finding good things.",
      tag: "wotd-2026-11-06",
      url: "/?q=serendipity",
    });
  });
  it("falls back when there is no lookup and shortens long definitions", () => {
    expect(buildWordOfTheDayPayload("keen", null, "2026-11-06").body).toBe("Tap to see what it means.");
    const long = buildWordOfTheDayPayload("keen", result("x".repeat(300)), "2026-11-06").body;
    expect(long.length).toBe(140);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("dispatchWordOfTheDay", () => {
  const row = (endpoint: string, local_date = "2026-11-06"): DuePushRow => ({ endpoint, p256dh: "p", auth: "a", local_date });

  it("sends to every claimed device, looks each date up once, and removes gone subscriptions", async () => {
    const sent: [PushTarget, string][] = [];
    const removed: string[] = [];
    let lookups = 0;
    const r = await dispatchWordOfTheDay({
      claim: async () => [row("ok1"), row("ok2"), row("gone"), row("err")],
      wordFor: async () => {
        lookups++;
        return { word: "keen", result: null };
      },
      send: async (target, payload) => {
        if (target.endpoint === "gone") throw Object.assign(new Error("gone"), { statusCode: 410 });
        if (target.endpoint === "err") throw Object.assign(new Error("boom"), { statusCode: 500 });
        sent.push([target, payload.title]);
      },
      removeSubscription: async (e) => {
        removed.push(e);
      },
      log: () => {},
    });
    expect(r).toEqual({ sent: 2, failed: 1, removed: 1 });
    expect(lookups).toBe(1);
    expect(removed).toEqual(["gone"]);
    expect(sent[0]).toEqual([{ endpoint: "ok1", keys: { p256dh: "p", auth: "a" } }, "Word of the Day: keen"]);
  });

  it("does nothing when nothing is due", async () => {
    const r = await dispatchWordOfTheDay({
      claim: async () => [],
      wordFor: async () => {
        throw new Error("should not look up");
      },
      send: async () => {},
      removeSubscription: async () => {},
    });
    expect(r).toEqual({ sent: 0, failed: 0, removed: 0 });
  });
});

describe("safeEqual", () => {
  it("compares exactly", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});
