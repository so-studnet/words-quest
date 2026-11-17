import { describe, expect, it } from "vitest";
import { MODEL_NAME, type AnkiCard } from "@/lib/domain/anki";
import { AnkiConnectError, httpInvoke, sendToAnki, type Invoke } from "./anki-connect";

const card = (key: string): AnkiCard => ({ key, front: key, back: `<b>${key}</b>`, tags: ["word", "learned-2026-11-12"] });

function fakeAnki(opts: { permission?: string; models?: string[]; notes?: Record<string, number[]>; failOn?: string } = {}) {
  const calls: [string, Record<string, unknown> | undefined][] = [];
  const invoke: Invoke = async <T>(action: string, params?: Record<string, unknown>) => {
    calls.push([action, params]);
    if (action === opts.failOn) throw new AnkiConnectError("anki", "boom");
    switch (action) {
      case "requestPermission":
        return { permission: opts.permission ?? "granted" } as T;
      case "modelNames":
        return (opts.models ?? []) as T;
      case "findNotes": {
        const q = String(params?.query);
        const hit = Object.entries(opts.notes ?? {}).find(([front]) => q.endsWith(`"Front:${front}"`));
        return (hit ? hit[1] : []) as T;
      }
      default:
        return null as T;
    }
  };
  return { invoke, calls, actions: () => calls.map((c) => c[0]) };
}

describe("sendToAnki", () => {
  it("creates the note type once, adds new notes, and updates existing ones", async () => {
    const anki = fakeAnki({ notes: { "break the ice": [42] } });
    const r = await sendToAnki(anki.invoke, [card("serendipity"), card("break the ice")]);
    expect(r).toEqual({ added: 1, updated: 1, failed: [] });
    expect(anki.actions()).toEqual([
      "requestPermission", "modelNames", "createModel", "createDeck",
      "findNotes", "addNote",
      "findNotes", "updateNoteFields", "addTags",
    ]);
    const add = anki.calls.find((c) => c[0] === "addNote")![1] as { note: Record<string, unknown> };
    expect(add.note).toMatchObject({ deckName: "Words Quest", modelName: MODEL_NAME, fields: { Front: "serendipity", Back: "<b>serendipity</b>" } });
    const upd = anki.calls.find((c) => c[0] === "updateNoteFields")![1];
    expect(upd).toEqual({ note: { id: 42, fields: { Back: "<b>break the ice</b>" } } });
  });

  it("skips createModel when the note type exists", async () => {
    const anki = fakeAnki({ models: [MODEL_NAME] });
    await sendToAnki(anki.invoke, [card("a")]);
    expect(anki.actions()).not.toContain("createModel");
  });

  it("stops when Anki denies this site", async () => {
    const anki = fakeAnki({ permission: "denied" });
    await expect(sendToAnki(anki.invoke, [card("a")])).rejects.toMatchObject({ code: "denied" });
    expect(anki.actions()).toEqual(["requestPermission"]);
  });

  it("reports cards Anki refused and keeps going", async () => {
    const anki = fakeAnki({ failOn: "addNote" });
    expect(await sendToAnki(anki.invoke, [card("a"), card("b")])).toEqual({ added: 0, updated: 0, failed: ["a", "b"] });
  });
});

describe("httpInvoke", () => {
  it("posts AnkiConnect v6 requests and unwraps the result", async () => {
    let sent: unknown;
    const f = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ result: ["Basic"], error: null }));
    }) as unknown as typeof fetch;
    expect(await httpInvoke("http://x", f)("modelNames")).toEqual(["Basic"]);
    expect(sent).toEqual({ action: "modelNames", version: 6, params: {} });
  });
  it("gives up when Anki does not answer (e.g. a hidden permission window)", async () => {
    const hang = ((_u: string, init: RequestInit) =>
      new Promise((_, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal!.reason));
      })) as unknown as typeof fetch;
    const invoke = httpInvoke("http://x", hang, { normal: 20, permission: 40 });
    await expect(invoke("requestPermission")).rejects.toMatchObject({ code: "timeout" });
    await expect(invoke("modelNames")).rejects.toMatchObject({ code: "timeout" });
  });

  it("maps network failures and Anki errors", async () => {
    const down = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(httpInvoke("http://x", down)("version")).rejects.toMatchObject({ code: "unreachable" });
    const err = (async () => new Response(JSON.stringify({ result: null, error: "deck was not found" }))) as unknown as typeof fetch;
    await expect(httpInvoke("http://x", err)("version")).rejects.toMatchObject({ code: "anki", message: "deck was not found" });
  });
});
