/**
 * Build an Anki package (.apkg): a zip with `collection.anki2` (SQLite, schema 11)
 * and an empty `media` map. Works in the browser (sql.js + WebAssembly) and in Node tests.
 */
import { zipSync, strToU8 } from "fflate";
import type { SqlJsStatic } from "sql.js";
import {
  ankiGuid,
  BACK_TEMPLATE,
  CARD_CSS,
  DECK_ID,
  DECK_NAME,
  FIELD_NAMES,
  FRONT_TEMPLATE,
  MODEL_ID,
  MODEL_NAME,
  stripHtml,
  type AnkiCard,
} from "@/lib/domain/anki";

const SCHEMA = `
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null,
  ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null,
  models text not null, decks text not null, dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null,
  usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null,
  flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null,
  mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null,
  ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null,
  odue integer not null, odid integer not null, flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null,
  ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);
`;

function deck(id: number, name: string, mod: number) {
  return {
    id, name, mod, desc: "", usn: -1, collapsed: false, browserCollapsed: false, dyn: 0, conf: 1,
    extendNew: 0, extendRev: 0, newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0],
  };
}

function model(mod: number) {
  return {
    id: MODEL_ID, name: MODEL_NAME, type: 0, mod, usn: -1, sortf: 0, did: DECK_ID,
    tmpls: [{ name: "Card 1", ord: 0, qfmt: FRONT_TEMPLATE, afmt: BACK_TEMPLATE, did: null, bqfmt: "", bafmt: "" }],
    flds: FIELD_NAMES.map((name, ord) => ({ name, ord, sticky: false, rtl: false, font: "Arial", size: 20, media: [] })),
    css: CARD_CSS,
    latexPre: "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
    latexPost: "\\end{document}",
    latexsvg: false,
    req: [[0, "any", [0]]],
    tags: [],
    vers: [],
  };
}

const DCONF = {
  1: {
    id: 1, name: "Default", mod: 0, usn: 0, maxTaken: 60, autoplay: true, timer: 0, replayq: true, dyn: false,
    new: { bury: false, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 0], order: 1, perDay: 20 },
    rev: { bury: false, ease4: 1.3, ivlFct: 1, maxIvl: 36500, perDay: 200, hardFactor: 1.2 },
    lapse: { delays: [10], leechAction: 1, leechFails: 8, minInt: 1, mult: 0 },
  },
};

/** Anki's first-field checksum: first 8 hex digits of SHA-1, as an integer. */
async function checksum(text: string): Promise<number> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return parseInt(hex.slice(0, 8), 16);
}

export async function buildApkg(cards: AnkiCard[], SQL: SqlJsStatic, now: Date = new Date()): Promise<Uint8Array> {
  const db = new SQL.Database();
  try {
    db.run(SCHEMA);
    const ms = now.getTime();
    const sec = Math.floor(ms / 1000);
    db.run("INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, '{}')", [
      Math.floor(sec / 86400) * 86400,
      ms,
      ms,
      JSON.stringify({ activeDecks: [1], curDeck: 1, newSpread: 0, collapseTime: 1200, timeLim: 0, estTimes: true, dueCounts: true, curModel: null, nextPos: cards.length + 1, sortType: "noteFld", sortBackwards: false, addToCur: true }),
      JSON.stringify({ [MODEL_ID]: model(sec) }),
      JSON.stringify({ 1: deck(1, "Default", sec), [DECK_ID]: deck(DECK_ID, DECK_NAME, sec) }),
      JSON.stringify(DCONF),
    ]);
    const insertNote = db.prepare("INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, '')");
    const insertCard = db.prepare("INSERT INTO cards VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, '')");
    for (const [i, c] of cards.entries()) {
      const noteId = ms + i; // unique, increasing
      const sortField = stripHtml(c.front);
      insertNote.run([
        noteId,
        ankiGuid(c.key),
        MODEL_ID,
        sec,
        c.tags.length ? ` ${c.tags.join(" ")} ` : "",
        [c.front, c.back].join("\x1f"),
        sortField,
        await checksum(sortField),
      ]);
      insertCard.run([noteId, noteId, DECK_ID, sec, i + 1]);
    }
    insertNote.free();
    insertCard.free();
    const collection = db.export();
    return zipSync({ "collection.anki2": collection, media: strToU8("{}") });
  } finally {
    db.close();
  }
}

/** File name like words-quest-2026-11-12.apkg */
export function apkgFileName(date: string): string {
  return `words-quest-${date}.apkg`;
}
