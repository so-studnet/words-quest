import { SearchForm } from "@/components/search-form";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:py-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Words Quest</h1>
        <p className="mt-1 text-muted">
          Look up any English word, phrase, idiom, or sentence.
        </p>
      </header>
      <SearchForm />
    </main>
  );
}
