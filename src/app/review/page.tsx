import type { Metadata } from "next";
import { RequireSignIn } from "@/components/require-sign-in";
import { ReviewView } from "./review-view";

export const metadata: Metadata = { title: "Review · Words Quest" };

export default function ReviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight">Review</h1>
      <RequireSignIn what="your reviews">
        <ReviewView />
      </RequireSignIn>
    </main>
  );
}
