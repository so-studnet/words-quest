import { describe, expect, it } from "vitest";
import { extractJson, LIMITS, parseAiResponse } from "./ai-response";
import { parseQuery, type ParsedQuery } from "./query";

function q(raw: string): ParsedQuery {
  const r = parseQuery(raw);
  if (!r.ok) throw new Error(r.error);
  return r.query;
}

const word = q("happy");
const good = {
  found: true,
  phonetic: "/ˈhæpi/",
  paraphrase: "ignored for words",
  senses: [
    {
      partOfSpeech: "Adjective",
      definition: "Feeling or showing pleasure.",
      examples: ["She looks happy today."],
      synonyms: ["glad", "Glad", "cheerful", "happy"],
      antonyms: ["sad"],
    },
  ],
  synonyms: ["joyful"],
  antonyms: ["unhappy"],
  notes: [],
};

describe("extractJson", () => {
  it("parses plain JSON, fenced JSON, and JSON with extra text", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"a":1} Hope this helps.')).toEqual({ a: 1 });
  });
  it("returns undefined for non-JSON", () => {
    expect(extractJson("no json here")).toBeUndefined();
    expect(extractJson("{broken")).toBeUndefined();
    expect(extractJson("")).toBeUndefined();
  });
});

describe("parseAiResponse", () => {
  it("builds a LookupResult for a word", () => {
    const r = parseAiResponse(JSON.stringify(good), word);
    expect(r).toEqual({
      ok: true,
      result: {
        query: "happy",
        kind: "word",
        phonetic: "/ˈhæpi/",
        paraphrase: null, // words have no paraphrase
        senses: [
          {
            partOfSpeech: "adjective",
            definition: "Feeling or showing pleasure.",
            examples: ["She looks happy today."],
            synonyms: ["glad", "cheerful"], // de-duplicated, query itself removed
            antonyms: ["sad"],
          },
        ],
        synonyms: ["joyful"],
        antonyms: ["unhappy"],
        notes: [],
        source: "ai",
      },
    });
  });

  it("returns not_found when the AI says so", () => {
    expect(parseAiResponse('{"found": false}', q("asdfgh"))).toEqual({ ok: false, error: "not_found" });
  });

  it("rejects unusable answers", () => {
    expect(parseAiResponse("not json", word)).toEqual({ ok: false, error: "invalid_response" });
    expect(parseAiResponse("[1,2]", word)).toEqual({ ok: false, error: "invalid_response" });
    expect(parseAiResponse('{"found": true, "senses": []}', word)).toEqual({
      ok: false,
      error: "invalid_response",
    });
    expect(parseAiResponse('{"senses": [{"definition": "  "}]}', word)).toMatchObject({ ok: false });
  });

  it("drops broken items but keeps the valid ones", () => {
    const raw = JSON.stringify({
      senses: [null, "text", { definition: 3 }, { definition: "Real one", examples: "x", synonyms: [1, "ok"] }],
      synonyms: "glad",
      notes: [null, "A note"],
    });
    const r = parseAiResponse(raw, word);
    expect(r.ok && r.result.senses).toEqual([
      { partOfSpeech: null, definition: "Real one", examples: [], synonyms: ["ok"], antonyms: [] },
    ]);
    expect(r.ok && r.result.synonyms).toEqual([]);
    expect(r.ok && r.result.notes).toEqual(["A note"]);
  });

  it("caps list lengths and long text", () => {
    const many = Array.from({ length: 30 }, (_, i) => `w${i}`);
    const raw = JSON.stringify({
      senses: Array.from({ length: 20 }, () => ({ definition: "d".repeat(2000), examples: many, synonyms: many })),
      synonyms: many,
    });
    const r = parseAiResponse(raw, word);
    if (!r.ok) throw new Error("expected ok");
    expect(r.result.senses).toHaveLength(LIMITS.senses);
    expect(r.result.senses[0].examples).toHaveLength(LIMITS.examples);
    expect(r.result.senses[0].synonyms).toHaveLength(LIMITS.senseWords);
    expect(r.result.senses[0].definition.length).toBe(LIMITS.text);
    expect(r.result.synonyms).toHaveLength(LIMITS.words);
  });

  it("uses paraphrase for sentences and drops phonetic and part of speech", () => {
    const s = q("I have been meaning to call you for ages.");
    const raw = JSON.stringify({
      phonetic: "/x/",
      paraphrase: "I wanted to call you for a long time.",
      senses: [{ partOfSpeech: "sentence", definition: "Said when you apologise for not calling." }],
      notes: ["'have been meaning to' = present perfect continuous of 'mean to'."],
    });
    const r = parseAiResponse(raw, s);
    if (!r.ok) throw new Error("expected ok");
    expect(r.result.kind).toBe("sentence");
    expect(r.result.phonetic).toBeNull();
    expect(r.result.paraphrase).toBe("I wanted to call you for a long time.");
    expect(r.result.senses[0].partOfSpeech).toBeNull();
  });

  it("accepts a paraphrase-only answer for a phrase", () => {
    const r = parseAiResponse('{"paraphrase": "to make people feel relaxed", "senses": []}', q("break the ice"));
    expect(r.ok && r.result.paraphrase).toBe("to make people feel relaxed");
  });

  it("treats the string 'null' as missing", () => {
    const r = parseAiResponse(JSON.stringify({ ...good, phonetic: "null" }), word);
    expect(r.ok && r.result.phonetic).toBeNull();
  });
});
