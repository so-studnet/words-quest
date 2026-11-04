"use client";

import Link from "next/link";
import { useState } from "react";
import { history, useHistory } from "@/lib/history-store";

const EXAMPLES = ["serendipity", "break the ice", "look forward to", "It's raining cats and dogs."];

function href(text: string) {
  return `/?q=${encodeURIComponent(text)}`;
}

export function HistoryList() {
  const entries = useHistory();
  const [confirming, setConfirming] = useState(false);

  if (entries.length === 0) {
    return (
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Try</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((t) => (
            <li key={t}>
              <Link href={href(t)} className="inline-block rounded-full border border-border px-3 py-1.5 hover:border-accent">
                {t}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Recent</h2>
        <button
          type="button"
          onClick={() => {
            if (confirming) {
              history.clear();
              setConfirming(false);
            } else {
              setConfirming(true);
            }
          }}
          onBlur={() => setConfirming(false)}
          className={`rounded-lg px-3 py-1.5 text-sm ${confirming ? "bg-red-600 font-semibold text-white" : "text-muted hover:text-foreground"}`}
        >
          {confirming ? "Tap again to clear" : "Clear all"}
        </button>
      </div>
      <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
        {entries.map((e) => (
          <li key={e.text} className="flex items-center">
            <Link href={href(e.text)} className="min-w-0 flex-1 truncate px-4 py-3">
              {e.text}
            </Link>
            <button
              type="button"
              onClick={() => history.remove(e.text)}
              aria-label={`Remove ${e.text} from history`}
              className="px-4 py-3 text-muted hover:text-foreground"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
