/**
 * Anki cards for study items (pure). Used by both the .apkg export and AnkiConnect,
 * so a card looks the same whichever way it reaches Anki.
 * Front: the query. Back: the full lookup result.
 */
import type { LookupResult } from "./lookup-result";
import { localDate, type StudyItem } from "./study";

export const DECK_NAME = "Words Quest";
export const MODEL_NAME = "Words Quest";
/** Fixed ids so every export maps to the same deck and note type in Anki. */
export const DECK_ID = 1_731_400_000_101;
export const MODEL_ID = 1_731_400_000_201;
export const FIELD_NAMES = ["Front", "Back"] as const;

/** Anki reads the word aloud on the back with the device's English voice. */
export const FRONT_TEMPLATE = `<div class="front">{{Front}}</div>`;
export const BACK_TEMPLATE = `<div class="front">{{Front}}</div>
{{tts en_US:Front}}
<hr id="answer">
{{Back}}`;

export const CARD_CSS = `.card {
  font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  font-size: 18px; line-height: 1.5; text-align: left;
  color: #171717; background: #ffffff; padding: 8px;
}
.nightMode.card, .night_mode .card { color: #ececec; background: #0f1115; }
.front { font-size: 30px; font-weight: 700; text-align: center; margin: 12px 0; }
.wq-kind { color: #5f6368; font-size: 14px; }
.wq-phonetic { color: #5f6368; }
.wq-paraphrase { font-size: 19px; margin: 8px 0; }
.wq-sense { border: 1px solid #d9dce1; border-radius: 10px; padding: 10px 12px; margin: 10px 0; }
.wq-pos { color: #2557d6; font-style: italic; font-weight: 600; font-size: 15px; }
.wq-ex { color: #5f6368; border-left: 2px solid #d9dce1; padding-left: 10px; margin: 6px 0; }
.wq-label { color: #5f6368; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.wq-words { margin: 4px 0 8px; }
.wq-notes { margin: 8px 0; padding-left: 20px; }
.nightMode .wq-kind, .nightMode .wq-phonetic, .nightMode .wq-ex, .nightMode .wq-label { color: #a0a4ab; }
.nightMode .wq-sense, .nightMode .wq-ex { border-color: #2c3038; }
.nightMode .wq-pos { color: #7ea2ff; }`;

const KIND_LABELS = { word: "Word", phrase: "Phrase / idiom", sentence: "Sentence" } as const;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function words(label: string, list: string[]): string {
  if (list.length === 0) return "";
  return `<div class="wq-label">${label}</div><div class="wq-words">${list.map(escapeHtml).join(", ")}</div>`;
}

/** The back of the card: everything the search result shows. */
export function cardBack(r: LookupResult): string {
  const parts: string[] = [`<div class="wq-kind">${KIND_LABELS[r.kind]}</div>`];
  if (r.phonetic) parts.push(`<div class="wq-phonetic">${escapeHtml(r.phonetic)}</div>`);
  if (r.paraphrase) parts.push(`<div class="wq-paraphrase">${escapeHtml(r.paraphrase)}</div>`);
  r.senses.forEach((s, i) => {
    const sense: string[] = [];
    if (s.partOfSpeech) sense.push(`<div class="wq-pos">${escapeHtml(s.partOfSpeech)}</div>`);
    sense.push(`<div>${i + 1}. ${escapeHtml(s.definition)}</div>`);
    for (const ex of s.examples) sense.push(`<div class="wq-ex">“${escapeHtml(ex)}”</div>`);
    sense.push(words("Synonyms", s.synonyms), words("Antonyms", s.antonyms));
    parts.push(`<div class="wq-sense">${sense.join("")}</div>`);
  });
  if (r.notes.length > 0) {
    parts.push(`<div class="wq-label">Notes</div><ul class="wq-notes">${r.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`);
  }
  const similar = r.kind === "word" ? "Synonyms" : "Similar";
  const opposite = r.kind === "word" ? "Antonyms" : "Opposite";
  parts.push(words(similar, r.synonyms), words(opposite, r.antonyms));
  return parts.filter(Boolean).join("\n");
}

/** Tags: the kind and the day the item was first learned (Japan time). */
export function cardTags(item: StudyItem): string[] {
  return [item.kind, `learned-${localDate(item.createdAt)}`];
}

export type AnkiCard = { key: string; front: string; back: string; tags: string[] };

/** null when the item has no saved result yet (it must be looked up first). */
export function toAnkiCard(item: StudyItem): AnkiCard | null {
  if (!item.result) return null;
  return { key: item.key, front: escapeHtml(item.text), back: cardBack(item.result), tags: cardTags(item) };
}

/**
 * Stable note id across exports (FNV-1a 64-bit of the key, base 36), so importing
 * the same entry again updates the existing note instead of adding a copy.
 */
const FNV_OFFSET = BigInt("0xcbf29ce484222325");
const FNV_PRIME = BigInt("0x100000001b3");
const MASK_64 = BigInt("0xffffffffffffffff");

export function ankiGuid(key: string): string {
  let h = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(key)) {
    h ^= BigInt(byte);
    h = (h * FNV_PRIME) & MASK_64;
  }
  return `wq${h.toString(36)}`;
}

/** Anki's sort field / checksum use the first field without HTML. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

/** A search term for Anki's search bar that matches the Front field exactly. */
export function frontSearch(front: string): string {
  const escaped = front.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\*/g, "\\*").replace(/_/g, "\\_");
  return `"note:${MODEL_NAME}" "Front:${escaped}"`;
}
