"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { localDate } from "@/lib/domain/study";
import { wordOfTheDay } from "@/lib/domain/word-of-the-day";

export function WordOfTheDayCard() {
  const word = wordOfTheDay(localDate(new Date()));
  const auth = useAuth();
  const card = (
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
  if (auth.status !== "signed-in") return card;
  // Signed in: a Random button next to the Word of the Day.
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3">
      {card}
      <Link
        href="/random"
        className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border px-4 hover:border-accent"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <path d="M16 3h5v5" /><path d="M4 20 21 3" /><path d="M21 16v5h-5" /><path d="M15 15l6 6" /><path d="M4 4l5 5" />
        </svg>
        <span className="text-sm font-semibold">Random</span>
      </Link>
    </div>
  );
}
