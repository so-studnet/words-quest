/**
 * Add cards to the Anki desktop app through the AnkiConnect add-on (http://127.0.0.1:8765).
 * The same note type and deck as the .apkg export; an existing note with the same Front
 * gets its Back and tags updated instead of a duplicate.
 */
import {
  BACK_TEMPLATE,
  CARD_CSS,
  DECK_NAME,
  FIELD_NAMES,
  FRONT_TEMPLATE,
  MODEL_NAME,
  frontSearch,
  type AnkiCard,
} from "@/lib/domain/anki";

export const ANKI_CONNECT_URL = "http://127.0.0.1:8765";

/** Normal calls answer at once. requestPermission waits until you click Yes/No in Anki. */
export const TIMEOUT_MS = 15_000;
export const PERMISSION_TIMEOUT_MS = 60_000;

export type Invoke = <T>(action: string, params?: Record<string, unknown>) => Promise<T>;

export class AnkiConnectError extends Error {
  constructor(
    readonly code: "unreachable" | "denied" | "anki" | "timeout",
    message: string,
  ) {
    super(message);
    this.name = "AnkiConnectError";
  }
}

export function httpInvoke(
  url = ANKI_CONNECT_URL,
  fetchImpl: typeof fetch = fetch,
  timeouts = { normal: TIMEOUT_MS, permission: PERMISSION_TIMEOUT_MS },
): Invoke {
  return async <T>(action: string, params: Record<string, unknown> = {}) => {
    const ms = action === "requestPermission" ? timeouts.permission : timeouts.normal;
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: "POST",
        body: JSON.stringify({ action, version: 6, params }),
        signal: AbortSignal.timeout(ms),
      });
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new AnkiConnectError("timeout", `Anki did not answer ${action} in ${ms / 1000}s`);
      }
      throw new AnkiConnectError("unreachable", "Could not reach Anki");
    }
    const body = (await res.json().catch(() => null)) as { result?: T; error?: string | null } | null;
    if (!body) throw new AnkiConnectError("anki", `AnkiConnect returned ${res.status}`);
    if (body.error) throw new AnkiConnectError("anki", body.error);
    return body.result as T;
  };
}

/** Ask Anki to allow this site (Anki shows a dialog the first time), then create the note type and deck if missing. */
export async function prepareAnki(invoke: Invoke): Promise<void> {
  const perm = await invoke<{ permission: string }>("requestPermission");
  if (perm?.permission !== "granted") throw new AnkiConnectError("denied", "Anki did not allow this site");
  const models = await invoke<string[]>("modelNames");
  if (!models.includes(MODEL_NAME)) {
    await invoke("createModel", {
      modelName: MODEL_NAME,
      inOrderFields: [...FIELD_NAMES],
      css: CARD_CSS,
      isCloze: false,
      cardTemplates: [{ Name: "Card 1", Front: FRONT_TEMPLATE, Back: BACK_TEMPLATE }],
    });
  }
  await invoke("createDeck", { deck: DECK_NAME }); // no-op if it exists
}

export type AddResult = { added: number; updated: number; failed: string[] };

export async function sendToAnki(invoke: Invoke, cards: AnkiCard[]): Promise<AddResult> {
  await prepareAnki(invoke);
  const result: AddResult = { added: 0, updated: 0, failed: [] };
  for (const card of cards) {
    try {
      const existing = await invoke<number[]>("findNotes", { query: frontSearch(card.front) });
      if (existing.length > 0) {
        for (const id of existing) {
          await invoke("updateNoteFields", { note: { id, fields: { Back: card.back } } });
        }
        await invoke("addTags", { notes: existing, tags: card.tags.join(" ") });
        result.updated++;
      } else {
        await invoke("addNote", {
          note: {
            deckName: DECK_NAME,
            modelName: MODEL_NAME,
            fields: { Front: card.front, Back: card.back },
            tags: card.tags,
            options: { allowDuplicate: false, duplicateScope: "deck" },
          },
        });
        result.added++;
      }
    } catch (e) {
      if (e instanceof AnkiConnectError && e.code === "unreachable") throw e;
      result.failed.push(card.key);
    }
  }
  return result;
}
