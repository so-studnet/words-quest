import { describe, expect, it } from "vitest";
import { parseQuery } from "./query";
import { addDays } from "./study";
import { WORDS, wordOfTheDay } from "./word-of-the-day";

describe("WORDS", () => {
  it("has only valid, unique single words", () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
    for (const w of WORDS) {
      const r = parseQuery(w);
      expect(r.ok && r.query.kind, w).toBe("word");
      expect(w).toBe(w.toLowerCase());
    }
  });
});

describe("wordOfTheDay", () => {
  it("is the same for the same date", () => {
    expect(wordOfTheDay("2026-11-06")).toBe(wordOfTheDay("2026-11-06"));
  });

  it("has no repeats in any run of WORDS.length days, across cycle boundaries too", () => {
    for (const start of ["2026-01-01", "2026-11-06", "2027-05-20"]) {
      const seen = new Set<string>();
      for (let i = 0; i < WORDS.length; i++) seen.add(wordOfTheDay(addDays(start, i)));
      expect(seen.size, start).toBe(WORDS.length);
    }
  });

  it("works for dates before the epoch and in later cycles", () => {
    expect(WORDS).toContain(wordOfTheDay("2025-06-01"));
    expect(WORDS).toContain(wordOfTheDay("2030-01-01"));
  });

  it("is shuffled, not alphabetical", () => {
    const first = Array.from({ length: 10 }, (_, i) => wordOfTheDay(addDays("2026-01-01", i)));
    expect(first).not.toEqual(WORDS.slice(0, 10));
  });
});
