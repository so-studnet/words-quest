import Link from "next/link";
import { Suspense } from "react";
import { SearchForm, SearchFormFallback } from "@/components/search-form";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:py-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          <Link href="/">Words Quest</Link>
        </h1>
        <p className="mt-1 text-muted">Look up any English word, phrase, idiom, or sentence.</p>
      </header>
      <Suspense fallback={<SearchFormFallback />}>
        <SearchForm />
      </Suspense>
      <footer className="mt-auto pt-8 text-sm text-muted">
        <Link href="/docs/api" className="hover:text-foreground hover:underline">
          API
        </Link>
      </footer>
    </main>
  );
}
