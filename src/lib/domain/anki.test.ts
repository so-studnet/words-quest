import { describe, expect, it } from "vitest";
import type { LookupResult } from "./lookup-result";
import type { StudyItem } from "./study";
import { ankiGuid, cardBack, escapeHtml, frontSearch, stripHtml, toAnkiCard } from "./anki";

const result: LookupResult = {
  query: "serendipity",
  kind: "word",
  phonetic: "/ˌserənˈdɪpəti/",
  paraphrase: null,
  senses: [
    { partOfSpeech: "noun", definition: "Luck <in> finding & things.", examples: ["A \"happy\" accident."], synonyms: ["luck", "chance"], antonyms: [] },
    { partOfSpeech: null, definition: "Second sense.", examples: [], synonyms: [], antonyms: ["design"] },
  ],
  synonyms: ["fortune"],
  antonyms: ["plan"],
  notes: ["Often positive."],
  source: "ai",
};

const item: StudyItem = {
  id: "i1", key: "serendipity", text: "Serendipity", kind: "word", result,
  stage: 0, dueOn: "2026-11-13", createdAt: "2026-11-11T16:00:00.000Z", // Nov 12 in Japan
};

describe("cardBack", () => {
  const back = cardBack(result);
  it("includes everything the search result shows, escaped", () => {
    expect(back).toContain("/ˌserənˈdɪpəti/");
    expect(back).toContain("1. Luck &lt;in&gt; finding &amp; things.");
    expect(back).toContain("“A &quot;happy&quot; accident.”");
    expect(back).toContain("2. Second sense.");
    expect(back).toContain("luck, chance");
    expect(back).toContain('<li>Often positive.</li>');
    expect(back).toContain("fortune");
    expect(back).toContain("plan");
    expect(back).not.toContain("<in>");
  });
  it("labels related expressions for phrases", () => {
    const phrase = cardBack({ ...result, kind: "phrase", phonetic: null, paraphrase: "To get lucky." });
    expect(phrase).toContain("Phrase / idiom");
    expect(phrase).toContain("To get lucky.");
    expect(phrase).toContain(">Similar<");
  });
  it("leaves out empty sections", () => {
    const bare = cardBack({ ...result, phonetic: null, notes: [], synonyms: [], antonyms: [] });
    expect(bare).not.toContain("Notes");
    expect(bare).not.toContain("wq-phonetic");
  });
});

describe("toAnkiCard", () => {
  it("uses the query as the front and tags kind and learned date (Japan time)", () => {
    expect(toAnkiCard(item)).toMatchObject({ key: "serendipity", front: "Serendipity", tags: ["word", "learned-2026-11-12"] });
  });
  it("returns null when there is no saved result", () => {
    expect(toAnkiCard({ ...item, result: null })).toBeNull();
  });
  it("escapes the front", () => {
    expect(toAnkiCard({ ...item, text: "rock & roll" })?.front).toBe("rock &amp; roll");
  });
});

describe("helpers", () => {
  it("makes a stable guid per key", () => {
    expect(ankiGuid("serendipity")).toBe(ankiGuid("serendipity"));
    expect(ankiGuid("serendipity")).not.toBe(ankiGuid("break the ice"));
    expect(ankiGuid("x")).toMatch(/^wq[0-9a-z]+$/);
  });
  it("escapes and strips HTML", () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
    expect(stripHtml("rock &amp; <b>roll</b>")).toBe("rock & roll");
  });
  it("builds an exact Front search, escaping Anki wildcards and quotes", () => {
    expect(frontSearch("break the ice")).toBe('"note:Words Quest" "Front:break the ice"');
    expect(frontSearch('say "hi"_*')).toBe('"note:Words Quest" "Front:say \\"hi\\"\\_\\*"');
  });
});

describe("ankiGuid value", () => {
  it("matches FNV-1a 64 (known vector for 'a')", () => {
    // FNV-1a 64 of "a" is 0xaf63dc4c8601ec8c
    expect(ankiGuid("a")).toBe(`wq${BigInt("0xaf63dc4c8601ec8c").toString(36)}`);
  });
});
