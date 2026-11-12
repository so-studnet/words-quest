"use client";

import { useState } from "react";
import { generateCronSecret, generateVapidKeys } from "@/lib/vapid";

type Keys = { publicKey: string; privateKey: string; cronSecret: string };

export function KeyGenerator() {
  const [keys, setKeys] = useState<Keys | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    try {
      const vapid = await generateVapidKeys();
      setKeys({ ...vapid, cronSecret: generateCronSecret() });
      setError(null);
    } catch (e) {
      console.error(e);
      setError("This browser cannot create the keys. Try a recent Chrome, Edge, Safari, or Firefox.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => void generate()}
        className="rounded-xl bg-accent px-5 py-3 text-lg font-semibold text-white dark:text-black"
      >
        {keys ? "Make new keys" : "Make keys"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {keys && (
        <>
          <KeyField name="NEXT_PUBLIC_VAPID_PUBLIC_KEY" value={keys.publicKey} note="Public. Safe to share." />
          <KeyField name="VAPID_PRIVATE_KEY" value={keys.privateKey} note="Secret. Mark as Sensitive in Vercel." />
          <KeyField
            name="CRON_SECRET"
            value={keys.cronSecret}
            note="Secret. Put it in Vercel (Sensitive) and in the Supabase cron SQL."
          />
        </>
      )}
    </div>
  );
}

function KeyField({ name, value, note }: { name: string; value: string; note: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-mono text-sm font-semibold break-all">{name}</h2>
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 font-mono text-sm break-all select-all">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
