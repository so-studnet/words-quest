"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ResultView } from "@/components/result-view";
import { SpeakButton } from "@/components/speak-button";
import { isApiErrorBody } from "@/lib/domain/lookup-error";
import { isLookupResult } from "@/lib/domain/lookup-result";
import { dueItems, localDate, MASTERED_STAGE, REVIEW_INTERVALS, type StudyItem } from "@/lib/domain/study";
import { shortDate } from "@/lib/format-date";
import { study, useStudy } from "@/lib/study-store";

const KIND_LABELS = { word: "Word", phrase: "Phrase / idiom", sentence: "Sentence" } as const;

export function ReviewView() {
  const s = useStudy();
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [doneCount, setDoneCount] = useState(0);

  if (s.status === "off" || (s.status === "loading" && s.data.items.length === 0)) {
    return <div aria-busy="true" aria-label="Loading" className="h-40 animate-pulse rounded-xl bg-border/50" />;
  }
  const today = localDate(new Date());
  const queue = dueItems(s.data.items, today);
  const item = queue[0];

  if (!item) {
    const upcoming = s.data.items
      .map((i) => i.dueOn)
      .filter((d): d is string => d !== null)
      .sort()[0];
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-border p-6 text-center">
        <p className="text-2xl font-bold">{doneCount > 0 ? "All done for today!" : "Nothing to review"}</p>
        {doneCount > 0 && <p className="text-muted">You reviewed {doneCount} {doneCount === 1 ? "entry" : "entries"}.</p>}
        <p className="text-muted">
          {upcoming ? `Next review: ${shortDate(upcoming)}.` : "Look things up to add them to your reviews."}
        </p>
        <Link href="/learned" className="text-accent hover:underline">
          See what you have learned
        </Link>
      </section>
    );
  }

  const revealed = revealedId === item.id;
  function grade(remembered: boolean) {
    study.review(item.id, remembered);
    setRevealedId(null);
    setDoneCount((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted tabular-nums">
        {queue.length} left · step {Math.min(item.stage + 1, MASTERED_STAGE)} of {REVIEW_INTERVALS.length}
      </p>

      {!revealed && (
        <section className="rounded-xl border border-border p-6">
          <p className="text-sm text-muted">{KIND_LABELS[item.kind]}</p>
          <div className="mt-1 flex items-start gap-3">
            <h2 className="min-w-0 flex-1 text-3xl font-bold break-words">{item.text}</h2>
            <SpeakButton text={item.text} label="Listen" />
          </div>
          <p className="mt-4 text-muted">Do you remember what it means?</p>
        </section>
      )}

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealedId(item.id)}
          className="rounded-xl bg-accent px-5 py-4 text-lg font-semibold text-white dark:text-black"
        >
          Show answer
        </button>
      ) : (
        <>
          <Answer key={item.id} item={item} />
          <div className="sticky bottom-16 -mx-4 grid grid-cols-2 gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
            <button
              type="button"
              onClick={() => grade(false)}
              className="rounded-xl border-2 border-border bg-background px-4 py-4 text-lg font-semibold"
            >
              Forgot
              <span className="block text-xs font-normal text-muted">again tomorrow</span>
            </button>
            <button
              type="button"
              onClick={() => grade(true)}
              className="rounded-xl bg-accent px-4 py-4 text-lg font-semibold text-white dark:text-black"
            >
              Remembered
              <span className="block text-xs font-normal opacity-80">
                {item.stage + 1 >= MASTERED_STAGE ? "mastered" : `in ${REVIEW_INTERVALS[item.stage + 1]} days`}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** The saved lookup; items imported from history have none, so fetch it once and keep it. */
function Answer({ item }: { item: StudyItem }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item.result) return;
    const controller = new AbortController();
    fetch(`/api/v1/lookup?q=${encodeURIComponent(item.text)}`, { signal: controller.signal })
      .then(async (res) => {
        const body: unknown = await res.json().catch(() => null);
        if (res.ok && isLookupResult(body)) study.attachResult(item.id, body);
        else setError(isApiErrorBody(body) ? body.error.message : "Could not load the answer.");
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Could not load the answer.");
      });
    return () => controller.abort();
  }, [item.id, item.text, item.result]);

  if (item.result) return <ResultView result={item.result} />;
  if (error)
    return (
      <section className="rounded-xl border border-border p-6">
        <h2 className="text-3xl font-bold break-words">{item.text}</h2>
        <p className="mt-2 text-muted">{error}</p>
      </section>
    );
  return <div aria-busy="true" aria-label="Loading" className="h-32 animate-pulse rounded-xl bg-border/50" />;
}
