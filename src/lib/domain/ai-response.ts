/**
 * Validate the AI's JSON answer and turn it into a LookupResult.
 * The AI can return anything, so every field is checked and cleaned.
 */
import type { LookupResult, Sense } from "./lookup-result";
import type { ParsedQuery } from "./query";

export const LIMITS = {
  senses: 8,
  examples: 3,
  senseWords: 8,
  words: 12,
  notes: 6,
  text: 600,
} as const;

export type AiParseResult =
  | { ok: true; result: LookupResult }
  | { ok: false; error: "not_found" | "invalid_response" };

/** Pull the JSON object out of the reply, tolerating ```json fences or extra text. */
export function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function cleanString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  if (s === "" || s.toLowerCase() === "null") return null;
  return s.length > LIMITS.text ? `${s.slice(0, LIMITS.text - 1)}…` : s;
}

/** Strings only, trimmed, de-duplicated (case-insensitive), without `exclude`, capped. */
function cleanList(v: unknown, max: number, exclude?: string): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>(exclude ? [exclude.toLowerCase()] : []);
  const out: string[] = [];
  for (const item of v) {
    const s = cleanString(item);
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function cleanSense(v: unknown, query: ParsedQuery): Sense | null {
  if (!isRecord(v)) return null;
  const definition = cleanString(v.definition);
  if (!definition) return null;
  return {
    partOfSpeech: query.kind === "sentence" ? null : cleanString(v.partOfSpeech)?.toLowerCase() ?? null,
    definition,
    examples: cleanList(v.examples, LIMITS.examples),
    synonyms: cleanList(v.synonyms, LIMITS.senseWords, query.key),
    antonyms: cleanList(v.antonyms, LIMITS.senseWords, query.key),
  };
}

export function parseAiResponse(raw: string, query: ParsedQuery): AiParseResult {
  const data = extractJson(raw);
  if (!isRecord(data)) return { ok: false, error: "invalid_response" };
  if (data.found === false) return { ok: false, error: "not_found" };

  const senses = (Array.isArray(data.senses) ? data.senses : [])
    .map((s) => cleanSense(s, query))
    .filter((s): s is Sense => s !== null)
    .slice(0, LIMITS.senses);
  const paraphrase = query.kind === "word" ? null : cleanString(data.paraphrase);
  if (senses.length === 0 && !paraphrase) return { ok: false, error: "invalid_response" };

  const phonetic = query.kind === "word" ? cleanString(data.phonetic) : null;
  return {
    ok: true,
    result: {
      query: query.text,
      kind: query.kind,
      phonetic,
      paraphrase,
      senses,
      synonyms: cleanList(data.synonyms, LIMITS.words, query.key),
      antonyms: cleanList(data.antonyms, LIMITS.words, query.key),
      notes: cleanList(data.notes, LIMITS.notes),
      source: "ai",
    },
  };
}
