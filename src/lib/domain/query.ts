/**
 * Normalizing and classifying what the user typed into the search box.
 * Pure functions only: no I/O, so they are easy to test.
 */

export type QueryKind = "word" | "phrase" | "sentence";

export const MAX_QUERY_LENGTH = 300;

/** A phrase has at most this many words; longer input is treated as a sentence. */
export const MAX_PHRASE_WORDS = 5;

export type ParsedQuery = {
  /** Whitespace-collapsed text, original casing kept (for display and AI prompts). */
  text: string;
  /** Lowercased `text`, used as the cache key. */
  key: string;
  kind: QueryKind;
  wordCount: number;
};

export type QueryError = "empty" | "too_long" | "not_english";

export type ParseResult =
  | { ok: true; query: ParsedQuery }
  | { ok: false; error: QueryError };

// Curly quotes/dashes are folded to ASCII before checking.
const ALLOWED = /^[A-Za-z0-9 .,!?;:'"()\-/&]+$/;
const HAS_LETTER = /[A-Za-z]/;
const TERMINAL_PUNCT = /[.!?]$/;

export function normalizeText(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text: string): number {
  return text.split(" ").filter((t) => HAS_LETTER.test(t)).length;
}

export function classify(text: string, wordCount: number): QueryKind {
  if (wordCount <= 1) return "word";
  if (wordCount > MAX_PHRASE_WORDS) return "sentence";
  // "Break a leg!" is an idiom, but "I like it." is a sentence: 3+ words
  // ending in sentence punctuation are treated as a sentence.
  if (TERMINAL_PUNCT.test(text) && wordCount >= 3) return "sentence";
  return "phrase";
}

export function parseQuery(raw: string): ParseResult {
  const text = normalizeText(raw);
  if (text === "" || !HAS_LETTER.test(text)) {
    return text === "" ? { ok: false, error: "empty" } : { ok: false, error: "not_english" };
  }
  if (text.length > MAX_QUERY_LENGTH) return { ok: false, error: "too_long" };
  if (!ALLOWED.test(text)) return { ok: false, error: "not_english" };

  const wordCount = countWords(text);
  const kind = classify(text, wordCount);
  // A single word is looked up without surrounding punctuation ("Hello!" -> "hello").
  const display = kind === "word" ? text.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "") : text;
  return {
    ok: true,
    query: { text: display, key: display.toLowerCase(), kind, wordCount },
  };
}

export const QUERY_ERROR_MESSAGES: Record<QueryError, string> = {
  empty: "Type a word, phrase, or sentence.",
  too_long: `Please keep it under ${MAX_QUERY_LENGTH} characters.`,
  not_english: "Only English letters and basic punctuation are supported.",
};
