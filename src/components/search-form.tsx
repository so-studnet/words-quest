"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { isApiErrorBody } from "@/lib/domain/lookup-error";
import type { LookupResult } from "@/lib/domain/lookup-result";
import { parseQuery, QUERY_ERROR_MESSAGES } from "@/lib/domain/query";
import { history } from "@/lib/history-store";
import { study } from "@/lib/study-store";
import { HistoryList } from "./history-list";
import { ResultView } from "./result-view";
import { WordOfTheDayCard } from "./word-of-the-day-card";

type FetchedBody =
  | { status: "done"; result: LookupResult }
  | { status: "error"; message: string; notFound: boolean };

/** A response, tagged with the query and retry attempt it belongs to. */
type Fetched = FetchedBody & { q: string; attempt: number };

function searchHref(text: string): string {
  return `/?q=${encodeURIComponent(text)}`;
}

async function fetchLookup(q: string, signal: AbortSignal): Promise<FetchedBody> {
  try {
    const res = await fetch(`/api/v1/lookup?q=${encodeURIComponent(q)}`, { signal });
    const body: unknown = await res.json().catch(() => null);
    if (res.ok && body) return { status: "done", result: body as LookupResult };
    if (isApiErrorBody(body)) {
      return { status: "error", message: body.error.message, notFound: body.error.code === "not_found" };
    }
    return { status: "error", message: "Something went wrong. Please try again.", notFound: false };
  } catch (e) {
    if (signal.aborted) throw e;
    return { status: "error", message: "Could not connect. Check your network and try again.", notFound: false };
  }
}

export function SearchForm() {
  const router = useRouter();
  const q = (useSearchParams().get("q") ?? "").trim();
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [inputError, setInputError] = useState<{ q: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!q || !parseQuery(q).ok) return;
    const controller = new AbortController();
    fetchLookup(q, controller.signal).then((body) => {
      setFetched({ ...body, q, attempt });
      if (body.status === "done") {
        history.add(body.result.query, body.result.kind);
        study.recordSearch(body.result); // no-op when signed out
      }
    }, () => {});
    return () => controller.abort();
  }, [q, attempt]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = String(new FormData(e.currentTarget).get("q") ?? "");
    const parsed = parseQuery(raw);
    if (!parsed.ok) {
      setInputError({ q, message: QUERY_ERROR_MESSAGES[parsed.error] });
      return;
    }
    setInputError(null);
    if (parsed.query.text !== q) router.push(searchHref(parsed.query.text));
  }

  const urlError = q && !parseQuery(q).ok ? QUERY_ERROR_MESSAGES[(parseQuery(q) as { error: "empty" }).error] : null;
  const error = inputError?.q === q ? inputError.message : urlError;
  const current = fetched?.q === q && fetched.attempt === attempt ? fetched : null;
  const loading = Boolean(q) && !urlError && !current;

  return (
    <div className="flex flex-col gap-4">
      <SearchBox key={q} defaultValue={q} onSubmit={onSubmit} busy={loading} />

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {!error && loading && <ResultSkeleton />}

      {!error && current?.status === "error" && (
        <section className="rounded-xl border border-border p-4">
          <h2 className="text-lg font-semibold">{current.notFound ? "No entry found" : "Lookup failed"}</h2>
          <p className="mt-1 text-muted">{current.message}</p>
          {!current.notFound && (
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="mt-3 rounded-lg border border-border px-4 py-2 font-semibold hover:border-accent"
            >
              Try again
            </button>
          )}
        </section>
      )}

      {!error && current?.status === "done" && <ResultView result={current.result} />}

      {!q && <WordOfTheDayCard />}
      {!q && <HistoryList />}
    </div>
  );
}

function SearchBox({
  defaultValue,
  onSubmit,
  busy,
}: {
  defaultValue: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  busy: boolean;
}) {
  return (
    <form onSubmit={onSubmit} role="search" className="flex gap-2">
      <label htmlFor="q" className="sr-only">
        Word, phrase, or sentence
      </label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Word or phrase"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-lg outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-accent px-5 py-3 text-lg font-semibold text-white disabled:opacity-60 dark:text-black"
      >
        Search
      </button>
    </form>
  );
}

export function SearchFormFallback() {
  return <SearchBox defaultValue="" onSubmit={(e) => e.preventDefault()} busy={false} />;
}

function ResultSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading" className="animate-pulse rounded-xl border border-border p-4">
      <div className="h-7 w-1/2 rounded bg-border" />
      <div className="mt-4 h-4 w-full rounded bg-border" />
      <div className="mt-2 h-4 w-5/6 rounded bg-border" />
      <div className="mt-2 h-4 w-2/3 rounded bg-border" />
    </section>
  );
}
