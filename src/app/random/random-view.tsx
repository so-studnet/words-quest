"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { SpeakButton } from "@/components/speak-button";
import {
  candidates,
  findEntry,
  KINDS,
  LEVELS,
  parseRandomFilter,
  pickRandom,
  RANDOM_ENTRIES,
  randomHref,
  type RandomFilter,
} from "@/lib/domain/random";
import { useStudy } from "@/lib/study-store";

const KIND_LABELS = { word: "Words", "phrasal verb": "Phrasal verbs", idiom: "Idioms" } as const;
const KIND_LABEL_ONE = { word: "Word", "phrasal verb": "Phrasal verb", idiom: "Idiom" } as const;

/**
 * Shows one random entry (no definition). Nothing is logged here: "Look it up" opens the
 * normal search, which logs it. Entries already in the study log are left out.
 */
export function RandomView() {
  const router = useRouter();
  const params = useSearchParams();
  const s = useStudy();
  const filter = parseRandomFilter((k) => params.get(k));
  const shownText = params.get("w");
  const shown = shownText ? findEntry(shownText) : null;
  const ready = s.status === "ready" || s.status === "error";

  const learned = useMemo(() => new Set(s.data.items.map((i) => i.key)), [s.data.items]);
  const pool = useMemo(() => candidates(RANDOM_ENTRIES, filter, learned), [filter.kind, filter.level, learned]); // eslint-disable-line react-hooks/exhaustive-deps

  // First visit (or a filter change): pick once the study log is loaded, so learned entries are excluded.
  useEffect(() => {
    if (!ready || shown) return;
    const next = pickRandom(pool);
    if (next) router.replace(randomHref(next.text, filter));
  }, [ready, shown, pool, filter, router]);

  const another = () => {
    const next = pickRandom(pool, shown?.text);
    if (next) router.push(randomHref(next.text, filter));
  };
  const setFilter = (f: RandomFilter) => router.replace(randomHref(null, f));

  if (!ready) return <div aria-busy="true" aria-label="Loading" className="h-56 animate-pulse rounded-xl bg-border/50" />;

  return (
    <div className="flex flex-col gap-5">
      <FilterRow
        label="Type"
        options={[["all", "All"], ...KINDS.map((k) => [k, KIND_LABELS[k]] as [string, string])]}
        value={filter.kind}
        onChange={(v) => setFilter({ ...filter, kind: v as RandomFilter["kind"] })}
      />
      <FilterRow
        label="Level"
        options={[["all", "All"], ...LEVELS.map((l) => [l, l] as [string, string])]}
        value={filter.level}
        onChange={(v) => setFilter({ ...filter, level: v as RandomFilter["level"] })}
      />

      {shown ? (
        <section aria-live="polite" className="rounded-xl border border-border p-6">
          <p className="flex items-center gap-2 text-sm text-muted">
            <span>{KIND_LABEL_ONE[shown.kind]}</span>
            <span aria-hidden="true">·</span>
            <span className="rounded-full border border-border px-2 text-xs font-semibold">{shown.level}</span>
          </p>
          <div className="mt-2 flex items-start gap-3">
            <h2 className="min-w-0 flex-1 text-4xl font-bold break-words">{shown.text}</h2>
            <SpeakButton text={shown.text} label="Listen" />
          </div>
          <p className="mt-3 text-sm text-muted">Do you know it? Look it up to see the meaning and save it.</p>
        </section>
      ) : (
        <section className="rounded-xl border border-border p-6 text-center">
          <p className="font-semibold">{pool.length === 0 ? "You have learned everything here!" : "Picking…"}</p>
          {pool.length === 0 && <p className="mt-1 text-sm text-muted">Try another type or level.</p>}
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        {shown ? (
          <Link
            href={`/?q=${encodeURIComponent(shown.text)}`}
            className="rounded-xl bg-accent px-4 py-3 text-center text-lg font-semibold text-white dark:text-black"
          >
            Look it up
          </Link>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={another}
          disabled={pool.length === 0 || (pool.length === 1 && pool[0].text === shown?.text)}
          className="rounded-xl border-2 border-border px-4 py-3 text-lg font-semibold disabled:opacity-50"
        >
          Another
        </button>
      </div>
      <p className="text-sm text-muted tabular-nums">
        {pool.length} {pool.length === 1 ? "entry" : "entries"} you have not looked up yet
        {filter.kind !== "all" || filter.level !== "all" ? " in this filter" : ""}.
      </p>
    </div>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="w-12 text-sm font-semibold text-muted">{label}</span>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`rounded-full border px-3 py-1 text-sm ${value === v ? "border-accent bg-accent font-semibold text-white dark:text-black" : "border-border hover:border-accent"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
