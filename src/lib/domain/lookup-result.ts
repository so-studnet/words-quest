/**
 * The one result shape the UI and the public API return, whatever the source
 * (dictionary API or AI). Providers convert their own responses into this.
 * Changing it is a breaking change for /api/v1/lookup: bump the API version.
 */
import type { QueryKind } from "./query";

export type Sense = {
  partOfSpeech: string | null; // "noun", "verb", "idiom", ... (null for sentences)
  definition: string;
  examples: string[];
  synonyms: string[];
  antonyms: string[];
};

export type LookupResult = {
  query: string;
  kind: QueryKind;
  phonetic: string | null; // e.g. "/ˌserənˈdipədē/", words only
  /** For phrases and sentences: a plain-English restatement. */
  paraphrase: string | null;
  senses: Sense[];
  /** Word-level synonyms/antonyms not tied to a single sense. */
  synonyms: string[];
  antonyms: string[];
  /** Sentences only: short notes on grammar, tone, or key expressions. */
  notes: string[];
  source: "dictionary" | "ai";
};

/**
 * Bump when the prompt or the LookupResult shape changes, so cached results
 * made by the old version are ignored and looked up again.
 */
export const RESULT_VERSION = 1;

const KINDS = ["word", "phrase", "sentence"];
const isStrings = (v: unknown) => Array.isArray(v) && v.every((s) => typeof s === "string");
const isNullableString = (v: unknown) => v === null || typeof v === "string";

/** Shape check for results read back from the cache. */
export function isLookupResult(v: unknown): v is LookupResult {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.query === "string" &&
    KINDS.includes(r.kind as string) &&
    isNullableString(r.phonetic) &&
    isNullableString(r.paraphrase) &&
    Array.isArray(r.senses) &&
    r.senses.every((s: unknown) => {
      if (typeof s !== "object" || s === null) return false;
      const x = s as Record<string, unknown>;
      return (
        isNullableString(x.partOfSpeech) &&
        typeof x.definition === "string" &&
        isStrings(x.examples) &&
        isStrings(x.synonyms) &&
        isStrings(x.antonyms)
      );
    }) &&
    isStrings(r.synonyms) &&
    isStrings(r.antonyms) &&
    isStrings(r.notes) &&
    (r.source === "ai" || r.source === "dictionary")
  );
}
