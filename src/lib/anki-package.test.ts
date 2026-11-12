import { unzipSync, strFromU8 } from "fflate";
import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import { ankiGuid, DECK_ID, MODEL_ID, type AnkiCard } from "@/lib/domain/anki";
import { buildApkg } from "./anki-package";

const cards: AnkiCard[] = [
  { key: "serendipity", front: "serendipity", back: "<div>luck</div>", tags: ["word", "learned-2026-11-12"] },
  { key: "break the ice", front: "break the ice", back: "<div>start talking</div>", tags: ["phrase", "learned-2026-11-11"] },
];

describe("buildApkg", () => {
  it("packs a schema-11 collection with one note and card per entry", async () => {
    const SQL = await initSqlJs();
    const apkg = await buildApkg(cards, SQL, new Date("2026-11-12T00:00:00Z"));
    const files = unzipSync(apkg);
    expect(Object.keys(files).sort()).toEqual(["collection.anki2", "media"]);
    expect(strFromU8(files.media)).toBe("{}");

    const db = new SQL.Database(files["collection.anki2"]);
    const col = db.exec("select ver, models, decks from col")[0].values[0];
    expect(col[0]).toBe(11);
    expect(Object.keys(JSON.parse(col[1] as string))).toEqual([String(MODEL_ID)]);
    expect(JSON.parse(col[2] as string)[DECK_ID].name).toBe("Words Quest");

    const notes = db.exec("select guid, mid, tags, flds, sfld from notes order by id")[0].values;
    expect(notes).toEqual([
      [ankiGuid("serendipity"), MODEL_ID, " word learned-2026-11-12 ", "serendipity\x1f<div>luck</div>", "serendipity"],
      [ankiGuid("break the ice"), MODEL_ID, " phrase learned-2026-11-11 ", "break the ice\x1f<div>start talking</div>", "break the ice"],
    ]);
    const cardRows = db.exec("select did, ord, type, queue, due from cards order by id")[0].values;
    expect(cardRows).toEqual([
      [DECK_ID, 0, 0, 0, 1],
      [DECK_ID, 0, 0, 0, 2],
    ]);
    db.close();
  });

  it("uses the SHA-1 based checksum", async () => {
    const SQL = await initSqlJs();
    const files = unzipSync(await buildApkg([cards[0]], SQL));
    const db = new SQL.Database(files["collection.anki2"]);
    const csum = db.exec("select csum from notes")[0].values[0][0] as number;
    const { createHash } = await import("node:crypto");
    expect(csum).toBe(parseInt(createHash("sha1").update("serendipity").digest("hex").slice(0, 8), 16));
    db.close();
  });
});
