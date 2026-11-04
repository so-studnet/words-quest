import { describe, expect, it } from "vitest";
import { classify, MAX_QUERY_LENGTH, normalizeText, parseQuery } from "./query";

function ok(raw: string) {
  const r = parseQuery(raw);
  if (!r.ok) throw new Error(`expected ok for ${JSON.stringify(raw)}, got ${r.error}`);
  return r.query;
}

describe("normalizeText", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeText("  break \t the\n ice  ")).toBe("break the ice");
  });
  it("folds curly quotes, dashes and full-width letters to ASCII", () => {
    expect(normalizeText("don’t")).toBe("don't");
    expect(normalizeText("“hi”")).toBe('"hi"');
    expect(normalizeText("well—being")).toBe("well-being");
    expect(normalizeText("ｈｅｌｌｏ")).toBe("hello");
  });
});

describe("parseQuery", () => {
  it("classifies a single word", () => {
    expect(ok("Serendipity")).toEqual({
      text: "Serendipity",
      key: "serendipity",
      kind: "word",
      wordCount: 1,
    });
  });
  it("keeps hyphens and apostrophes inside a word", () => {
    expect(ok("well-being").kind).toBe("word");
    expect(ok("don't").kind).toBe("word");
  });
  it("strips punctuation around a single word", () => {
    expect(ok("Hello!").text).toBe("Hello");
    expect(ok('"run"').key).toBe("run");
  });
  it("classifies idioms and phrasal verbs as phrases", () => {
    expect(ok("break the ice").kind).toBe("phrase");
    expect(ok("look up").kind).toBe("phrase");
    expect(ok("Break a leg!").kind).toBe("sentence");
    expect(ok("once in a blue moon").kind).toBe("phrase");
  });
  it("classifies long input or punctuated clauses as sentences", () => {
    expect(ok("I have been meaning to call you for ages").kind).toBe("sentence");
    expect(ok("I like it.").kind).toBe("sentence");
  });
  it("uses a lowercase, whitespace-collapsed cache key", () => {
    expect(ok("  Break   The Ice ").key).toBe("break the ice");
  });
  it("rejects empty input", () => {
    expect(parseQuery("")).toEqual({ ok: false, error: "empty" });
    expect(parseQuery("   ")).toEqual({ ok: false, error: "empty" });
  });
  it("rejects non-English text", () => {
    expect(parseQuery("こんにちは")).toEqual({ ok: false, error: "not_english" });
    expect(parseQuery("hello 世界")).toEqual({ ok: false, error: "not_english" });
    expect(parseQuery("123")).toEqual({ ok: false, error: "not_english" });
    expect(parseQuery("<script>")).toEqual({ ok: false, error: "not_english" });
  });
  it("rejects input over the length limit", () => {
    expect(parseQuery("a".repeat(MAX_QUERY_LENGTH))).toMatchObject({ ok: true });
    expect(parseQuery("a".repeat(MAX_QUERY_LENGTH + 1))).toEqual({ ok: false, error: "too_long" });
  });
});

describe("classify boundaries", () => {
  it("treats up to 5 words as a phrase and 6 as a sentence", () => {
    expect(classify("a b c d e", 5)).toBe("phrase");
    expect(classify("a b c d e f", 6)).toBe("sentence");
  });
  it("does not treat a 2-word punctuated phrase as a sentence", () => {
    expect(classify("Good luck!", 2)).toBe("phrase");
  });
});
