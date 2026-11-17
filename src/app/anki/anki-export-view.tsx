"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AnkiConnectError, httpInvoke, sendToAnki } from "@/lib/anki-connect";
import { buildApkgFile, deliverFile, isMobileDevice, prepareCards } from "@/lib/anki-export";
import { apkgFileName } from "@/lib/anki-package";
import { localDate, type StudyItem } from "@/lib/domain/study";
import { dayLabel } from "@/lib/format-date";
import { useStudy } from "@/lib/study-store";

const noop = () => () => {};
const useIsMobile = () => useSyncExternalStore(noop, isMobileDevice, () => false);

type Status =
  | { kind: "idle" }
  | { kind: "working"; text: string }
  | { kind: "done"; text: string }
  | { kind: "error"; text: string };

export function AnkiExportView() {
  const s = useStudy();
  const mobile = useIsMobile();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const today = localDate(new Date());
  // Newest first, grouped by the day each entry was first learned.
  const groups = useMemo(() => {
    const items = [...s.data.items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const map = new Map<string, StudyItem[]>();
    for (const i of items) {
      const d = localDate(i.createdAt);
      map.set(d, [...(map.get(d) ?? []), i]);
    }
    return [...map.entries()];
  }, [s.data.items]);

  if (s.status === "off" || (s.status === "loading" && s.data.items.length === 0)) {
    return <div aria-busy="true" aria-label="Loading" className="h-40 animate-pulse rounded-xl bg-border/50" />;
  }
  if (s.data.items.length === 0) {
    return <p className="text-muted">Nothing to send yet. Entries you look up while signed in appear here.</p>;
  }

  const busy = status.kind === "working";
  const chosen = s.data.items.filter((i) => selected.has(i.id));
  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  async function withCards(run: (cards: Awaited<ReturnType<typeof prepareCards>>) => Promise<string>) {
    try {
      setStatus({ kind: "working", text: "Preparing cards…" });
      const prepared = await prepareCards(chosen, (done, total) =>
        setStatus({ kind: "working", text: `Preparing cards… ${done}/${total}` }),
      );
      if (prepared.cards.length === 0) {
        setStatus({ kind: "error", text: "Could not load any of the selected entries. Please try again later." });
        return;
      }
      const message = await run(prepared);
      const skipped = prepared.missing.length ? ` Skipped (could not load): ${prepared.missing.join(", ")}.` : "";
      setStatus({ kind: "done", text: message + skipped });
    } catch (e) {
      console.error("[anki]", e);
      setStatus({ kind: "error", text: errorMessage(e) });
    }
  }

  const exportApkg = () =>
    withCards(async ({ cards }) => {
      setStatus({ kind: "working", text: "Making the deck file…" });
      const how = await deliverFile(await buildApkgFile(cards, apkgFileName(today)));
      if (how === "cancelled") return "Cancelled.";
      return how === "shared"
        ? `Shared ${cards.length} ${cards.length === 1 ? "card" : "cards"}. Choose AnkiMobile to import.`
        : `Downloaded ${cards.length} ${cards.length === 1 ? "card" : "cards"}. Open the file to import it into Anki.`;
    });

  const sendDesktop = () =>
    withCards(async ({ cards }) => {
      setStatus({
        kind: "working",
        text: "Sending to Anki… If nothing happens, switch to the Anki window and click Yes to allow this site.",
      });
      const r = await sendToAnki(httpInvoke(), cards);
      const failed = r.failed.length ? ` Anki refused: ${r.failed.join(", ")}.` : "";
      return `Added ${r.added}, updated ${r.updated} in Anki.${failed}`;
    });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted">
        Front: the word or phrase. Back: the full entry. Cards go to the <span className="font-semibold">Words Quest</span>{" "}
        deck. Sending an entry again updates its card.
      </p>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="mr-1 font-semibold tabular-nums">{chosen.length} selected</span>
        <SelectButton onClick={() => setSelected(new Set(s.data.items.map((i) => i.id)))}>All</SelectButton>
        <SelectButton
          onClick={() => setSelected(new Set(s.data.items.filter((i) => localDate(i.createdAt) === today).map((i) => i.id)))}
        >
          Today
        </SelectButton>
        <SelectButton onClick={() => setSelected(new Set())}>None</SelectButton>
      </div>

      <div className="flex flex-col gap-5">
        {groups.map(([date, items]) => {
          const allOn = items.every((i) => selected.has(i.id));
          return (
            <section key={date} aria-label={dayLabel(date, today)}>
              <label className="flex items-center gap-3 text-sm font-semibold uppercase tracking-wide text-muted">
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={(e) => toggle(items.map((i) => i.id), e.target.checked)}
                  className="h-5 w-5 accent-[var(--accent)]"
                />
                {dayLabel(date, today)}
              </label>
              <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                {items.map((i) => (
                  <li key={i.id}>
                    <label className="flex items-center gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(i.id)}
                        onChange={(e) => toggle([i.id], e.target.checked)}
                        className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                      />
                      <span className="min-w-0 flex-1 truncate">{i.text}</span>
                      <span className="text-xs text-muted">{i.kind}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="sticky bottom-16 -mx-4 flex flex-col gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        {status.kind !== "idle" && (
          <p
            role={status.kind === "error" ? "alert" : "status"}
            className={`text-sm ${status.kind === "error" ? "text-red-700 dark:text-red-400" : "text-muted"}`}
          >
            {status.text}
          </p>
        )}
        <div className={`grid gap-2 ${mobile ? "grid-cols-1" : "grid-cols-2"}`}>
          <button
            type="button"
            disabled={busy || chosen.length === 0}
            onClick={() => void exportApkg()}
            className="rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-50 dark:text-black"
          >
            {mobile ? "Share .apkg" : "Download .apkg"}
          </button>
          {!mobile && (
            <button
              type="button"
              disabled={busy || chosen.length === 0}
              onClick={() => void sendDesktop()}
              className="rounded-xl border-2 border-border px-4 py-3 font-semibold disabled:opacity-50"
            >
              Add to Anki on this PC
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SelectButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full border border-border px-3 py-1 hover:border-accent">
      {children}
    </button>
  );
}

function errorMessage(e: unknown): string {
  if (e instanceof AnkiConnectError) {
    if (e.code === "unreachable")
      return "Could not reach Anki. Open Anki on this PC (with the AnkiConnect add-on) and try again.";
    if (e.code === "denied") return "Anki did not allow this site. Try again and choose Yes in Anki.";
    if (e.code === "timeout")
      return "Anki did not answer. Look for a permission window in Anki (it may be behind other windows), click Yes, and try again. If no window appears, add this site to webCorsOriginList in the AnkiConnect config.";
    return `Anki said: ${e.message}`;
  }
  return "Something went wrong. Please try again.";
}
