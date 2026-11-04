import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_LIMITS } from "@/lib/domain/rate-limit";
import { MAX_QUERY_LENGTH, MAX_PHRASE_WORDS } from "@/lib/domain/query";

export const metadata: Metadata = {
  title: "API · Words Quest",
  description: "Look up English words, phrases, idioms, and sentences from your own site.",
};

const EXAMPLE_RESPONSE = `{
  "query": "break the ice",
  "kind": "phrase",
  "phonetic": null,
  "paraphrase": "To make people feel more relaxed when they first meet.",
  "senses": [
    {
      "partOfSpeech": "idiom",
      "definition": "To start a conversation or make a social situation less awkward.",
      "examples": ["He told a funny story to break the ice."],
      "synonyms": ["get the ball rolling"],
      "antonyms": []
    }
  ],
  "synonyms": ["start a conversation", "lighten the mood"],
  "antonyms": [],
  "notes": [],
  "source": "ai"
}`;

const EXAMPLE_FETCH = `// Replace with this site's address, e.g. https://words-quest.vercel.app
const BASE = "https://<this-site>";

const res = await fetch(
  BASE + "/api/v1/lookup?q=" + encodeURIComponent("break the ice")
);
const data = await res.json();
if (!res.ok) throw new Error(data.error.message);
console.log(data.senses[0].definition);`;

const FIELDS: [string, string, string][] = [
  ["query", "string", "The input after cleanup (extra spaces removed)."],
  ["kind", '"word" | "phrase" | "sentence"', `How the input was classified. Up to ${MAX_PHRASE_WORDS} words is a phrase; longer input, or 3+ words ending in . ! ?, is a sentence.`],
  ["phonetic", "string | null", "IPA pronunciation. Words only."],
  ["paraphrase", "string | null", "The meaning in plain English. Phrases and sentences only."],
  ["senses", "Sense[]", "Meanings, most common first. Each has partOfSpeech, definition, examples, synonyms, antonyms."],
  ["synonyms", "string[]", "Similar words or expressions overall."],
  ["antonyms", "string[]", "Opposite words or expressions overall."],
  ["notes", "string[]", "Grammar, tone, and usage notes (mainly for sentences)."],
  ["source", '"ai" | "dictionary"', "Where the entry came from. Currently always \"ai\"."],
];

const ERRORS: [number, string, string][] = [
  [400, "invalid_query", `q is empty, not English, or longer than ${MAX_QUERY_LENGTH} characters.`],
  [403, "forbidden_origin", "Called from a browser on a site that is not allowed."],
  [404, "not_found", "No such word or expression."],
  [429, "rate_limited", "Too many lookups. Try again later."],
  [502, "upstream_error", "The AI service is unavailable."],
  [502, "invalid_response", "The AI answer could not be read."],
  [503, "not_configured", "The server is not set up yet."],
];

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-border p-4 text-sm leading-relaxed">
      <code className="font-mono">{children}</code>
    </pre>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-4 text-xl font-bold">
      {children}
    </h2>
  );
}

export default function ApiDocs() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 sm:py-12">
      <p>
        <Link href="/" className="text-accent hover:underline">
          ← Words Quest
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">API</h1>
      <p className="text-muted">
        Look up an English word, phrase, idiom, or sentence and get definitions, examples, synonyms, and antonyms as
        JSON. No API key is needed.
      </p>

      <H2 id="endpoint">Endpoint</H2>
      <Code>{"GET /api/v1/lookup?q=<text>"}</Code>
      <ul className="list-disc pl-5">
        <li>
          <code className="font-mono">q</code> (required): English text, up to {MAX_QUERY_LENGTH} characters. Letters,
          numbers, and basic punctuation only.
        </li>
        <li>Matching ignores case and extra spaces, so “Break the  ice” and “break the ice” give the same entry.</li>
        <li>
          The <code className="font-mono">X-Cache</code> header is <code className="font-mono">HIT</code> when the
          answer came from the cache and <code className="font-mono">MISS</code> when it was generated just now.
        </li>
      </ul>

      <H2 id="example">Example</H2>
      <Code>{EXAMPLE_FETCH}</Code>

      <H2 id="response">Response (200)</H2>
      <Code>{EXAMPLE_RESPONSE}</Code>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="p-3">Field</th>
              <th className="p-3">Type</th>
              <th className="p-3">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {FIELDS.map(([f, t, d]) => (
              <tr key={f}>
                <td className="p-3 font-mono">{f}</td>
                <td className="p-3 font-mono text-muted">{t}</td>
                <td className="p-3">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="errors">Errors</H2>
      <p>
        Errors return <code className="font-mono">{'{ "error": { "code": "...", "message": "..." } }'}</code>. Show{" "}
        <code className="font-mono">message</code> to people; branch on <code className="font-mono">code</code>.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="p-3">Status</th>
              <th className="p-3">Code</th>
              <th className="p-3">Meaning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ERRORS.map(([s, c, m]) => (
              <tr key={c}>
                <td className="p-3">{s}</td>
                <td className="p-3 font-mono">{c}</td>
                <td className="p-3">{m}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="limits">Limits</H2>
      <ul className="list-disc pl-5">
        <li>
          New lookups are limited to {DEFAULT_LIMITS.perIpPerHour} per hour per IP address and{" "}
          {DEFAULT_LIMITS.aiPerDay} per day for the whole site (by default).
        </li>
        <li>Cached entries are not counted, so popular words never run out.</li>
      </ul>

      <H2 id="cors">Calling from another website</H2>
      <p>
        Browsers on other sites can call the API only if the site is on the allowed list. Server-side calls (no{" "}
        <code className="font-mono">Origin</code> header) work from anywhere.
      </p>

      <p className="mt-6 text-xs text-muted">Entries are generated by AI and can contain mistakes.</p>
    </main>
  );
}
