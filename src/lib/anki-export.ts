"use client";

import { isApiErrorBody } from "@/lib/domain/lookup-error";
import { isLookupResult, type LookupResult } from "@/lib/domain/lookup-result";
import { toAnkiCard, type AnkiCard } from "@/lib/domain/anki";
import type { StudyItem } from "@/lib/domain/study";
import { study } from "@/lib/study-store";

/**
 * Cards for the chosen items. Items imported from history have no saved result yet:
 * look each one up (and keep it in the study log). Items that still fail are returned in `missing`.
 */
export async function prepareCards(
  items: StudyItem[],
  onProgress: (done: number, total: number) => void,
): Promise<{ cards: AnkiCard[]; missing: string[] }> {
  const cards: AnkiCard[] = [];
  const missing: string[] = [];
  let done = 0;
  for (const item of items) {
    let ready = item;
    if (!item.result) {
      const result = await fetchResult(item.text);
      if (result) {
        study.attachResult(item.id, result);
        ready = { ...item, result };
      }
    }
    const card = toAnkiCard(ready);
    if (card) cards.push(card);
    else missing.push(item.text);
    onProgress(++done, items.length);
  }
  return { cards, missing };
}

async function fetchResult(text: string): Promise<LookupResult | null> {
  try {
    const res = await fetch(`/api/v1/lookup?q=${encodeURIComponent(text)}`);
    const body: unknown = await res.json().catch(() => null);
    if (res.ok && isLookupResult(body)) return body;
    if (isApiErrorBody(body)) console.warn(`[anki] ${text}: ${body.error.code}`);
    return null;
  } catch {
    return null;
  }
}

export async function buildApkgFile(cards: AnkiCard[], fileName: string): Promise<File> {
  const [{ default: initSqlJs }, { buildApkg }] = await Promise.all([import("sql.js"), import("@/lib/anki-package")]);
  const SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  const bytes = await buildApkg(cards, SQL);
  return new File([bytes.slice().buffer], fileName, { type: "application/octet-stream" });
}

/** Phones and tablets: hand the file to the share sheet (e.g. AnkiMobile). */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Share on phones when possible, otherwise download. Returns how the file was handed over. */
export async function deliverFile(file: File): Promise<"shared" | "downloaded" | "cancelled"> {
  if (isMobileDevice() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return "shared";
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return "cancelled";
      // Fall through to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
