import { describe, expect, it } from "vitest";
import { isLookupResult, type LookupResult } from "./lookup-result";

const ok: LookupResult = {
  query: "happy",
  kind: "word",
  phonetic: null,
  paraphrase: null,
  senses: [{ partOfSpeech: "adjective", definition: "d", examples: [], synonyms: [], antonyms: [] }],
  synonyms: [],
  antonyms: [],
  notes: [],
  source: "ai",
};

describe("isLookupResult", () => {
  it("accepts a valid result", () => {
    expect(isLookupResult(ok)).toBe(true);
  });
  it("rejects broken shapes", () => {
    expect(isLookupResult(null)).toBe(false);
    expect(isLookupResult({ ...ok, kind: "poem" })).toBe(false);
    expect(isLookupResult({ ...ok, senses: [{ definition: 1 }] })).toBe(false);
    expect(isLookupResult({ ...ok, notes: [1] })).toBe(false);
    const noSource: Partial<LookupResult> = { ...ok };
    delete noSource.source;
    expect(isLookupResult(noSource)).toBe(false);
  });
});
