"use client";

import { useState } from "react";
import { parseQuery, QUERY_ERROR_MESSAGES, type ParsedQuery } from "@/lib/domain/query";

const KIND_LABELS: Record<ParsedQuery["kind"], string> = {
  word: "Word",
  phrase: "Phrase / idiom",
  sentence: "Sentence",
};

export function SearchForm() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState<ParsedQuery | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = parseQuery(input);
    if (result.ok) {
      setQuery(result.query);
      setError(null);
    } else {
      setQuery(null);
      setError(QUERY_ERROR_MESSAGES[result.error]);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Word, phrase, or sentence
        </label>
        <input
          id="q"
          name="q"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. serendipity, break the ice"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-lg outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-xl bg-accent px-5 py-3 text-lg font-semibold text-white dark:text-black"
        >
          Search
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {query && (
        <section aria-live="polite" className="rounded-xl border border-border p-4">
          <p className="text-sm text-muted">{KIND_LABELS[query.kind]}</p>
          <h2 className="mt-1 text-2xl font-semibold break-words">{query.text}</h2>
          <p className="mt-3 text-muted">
            Definitions, synonyms, antonyms, and examples will appear here soon.
          </p>
        </section>
      )}
    </div>
  );
}
