"use client";

import Link from "next/link";
import { localDate } from "@/lib/domain/study";
import { wordOfTheDay } from "@/lib/domain/word-of-the-day";

export function WordOfTheDayCard() {
  const word = wordOfTheDay(localDate(new Date()));
  return (
    <Link
      href={`/?q=${encodeURIComponent(word)}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-border p-4 hover:border-accent"
    >
      <span>
        <span className="block text-sm font-semibold uppercase tracking-wide text-muted">Word of the Day</span>
        <span className="mt-1 block text-2xl font-bold">{word}</span>
      </span>
      <span aria-hidden="true" className="text-2xl text-muted">
        →
      </span>
    </Link>
  );
}
