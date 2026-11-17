import { describe, expect, it } from "vitest";
import { parseQuery } from "./query";
import {
  ALL,
  candidates,
  findEntry,
  parseRandomFilter,
  pickRandom,
  RANDOM_ENTRIES,
  randomHref,
  type RandomEntry,
} from "./random";

describe("RANDOM_ENTRIES", () => {
  it("has about 1,800 unique entries", () => {
    expect(RANDOM_ENTRIES.length).toBeGreaterThan(1500);
    expect(new Set(RANDOM_ENTRIES.map((e) => e.text.toLowerCase())).size).toBe(RANDOM_ENTRIES.length);
  });
  it("words are single words; phrasal verbs and idioms are phrases the search accepts", () => {
    for (const e of RANDOM_ENTRIES) {
      const r = parseQuery(e.text);
      expect(r.ok, e.text).toBe(true);
      if (!r.ok) continue;
      expect(r.query.kind, e.text).toBe(e.kind === "word" ? "word" : "phrase");
      expect(r.query.text, e.text).toBe(e.text); // no cleanup needed
    }
  });
  it("covers every kind and level that has entries", () => {
    const combos = new Set(RANDOM_ENTRIES.map((e) => `${e.kind}/${e.level}`));
    for (const c of ["word/B1", "word/C2", "phrasal verb/B1", "phrasal verb/C1", "idiom/B1", "idiom/C2"]) {
      expect(combos.has(c), c).toBe(true);
    }
  });
});

const sample: RandomEntry[] = [
  { text: "keen", kind: "word", level: "B2" },
  { text: "Serendipity", kind: "word", level: "C2" },
  { text: "give up", kind: "phrasal verb", level: "B1" },
  { text: "break the ice", kind: "idiom", level: "B1" },
];

describe("parseRandomFilter", () => {
  it("reads known values and ignores the rest", () => {
    const get = (m: Record<string, string>) => (k: string) => m[k] ?? null;
    expect(parseRandomFilter(get({ kind: "idiom", level: "C1" }))).toEqual({ kind: "idiom", level: "C1" });
    expect(parseRandomFilter(get({ kind: "verb", level: "A1" }))).toEqual(ALL);
    expect(parseRandomFilter(get({}))).toEqual(ALL);
  });
});

describe("candidates", () => {
  it("filters by kind and level", () => {
    expect(candidates(sample, { kind: "word", level: "all" }, new Set()).map((e) => e.text)).toEqual(["keen", "Serendipity"]);
    expect(candidates(sample, { kind: "all", level: "B1" }, new Set()).map((e) => e.text)).toEqual(["give up", "break the ice"]);
    expect(candidates(sample, { kind: "idiom", level: "C2" }, new Set())).toEqual([]);
  });
  it("leaves out entries already learned, ignoring case", () => {
    expect(candidates(sample, ALL, new Set(["serendipity", "give up"])).map((e) => e.text)).toEqual(["keen", "break the ice"]);
  });
});

describe("pickRandom", () => {
  it("picks by the random number", () => {
    expect(pickRandom(sample, undefined, () => 0)?.text).toBe("keen");
    expect(pickRandom(sample, undefined, () => 0.999)?.text).toBe("break the ice");
  });
  it("avoids the entry on screen when possible", () => {
    for (const r of [0, 0.3, 0.6, 0.99]) expect(pickRandom(sample, "keen", () => r)?.text).not.toBe("keen");
    expect(pickRandom([sample[0]], "keen", () => 0)?.text).toBe("keen"); // the only choice
  });
  it("returns null for an empty list and survives rand() === 1", () => {
    expect(pickRandom([], undefined)).toBeNull();
    expect(pickRandom(sample, undefined, () => 1)?.text).toBe("break the ice");
  });
});

describe("findEntry / randomHref", () => {
  it("finds entries ignoring case", () => {
    expect(findEntry("SERENDIPITY")).toMatchObject({ kind: "word", level: "C2" });
    expect(findEntry("not a listed entry")).toBeNull();
  });
  it("builds URLs, leaving out defaults", () => {
    expect(randomHref("give up", { kind: "phrasal verb", level: "B1" })).toBe("/random?w=give+up&kind=phrasal+verb&level=B1");
    expect(randomHref(null, ALL)).toBe("/random");
  });
});
