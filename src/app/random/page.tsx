import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RequireSignIn } from "@/components/require-sign-in";
import { RandomView } from "./random-view";

export const metadata: Metadata = { title: "Random · Words Quest" };

export default function RandomPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:py-12">
      <p>
        <Link href="/" className="text-accent hover:underline">
          ← Search
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Random</h1>
      <RequireSignIn what="random words">
        <Suspense fallback={<div aria-busy="true" className="h-56 animate-pulse rounded-xl bg-border/50" />}>
          <RandomView />
        </Suspense>
      </RequireSignIn>
    </main>
  );
}
