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
