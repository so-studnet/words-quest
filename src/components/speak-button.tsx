"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};
function useSpeechSupported() {
  return useSyncExternalStore(
    noop,
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    () => false,
  );
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === "en-US") ?? voices.find((v) => v.lang.startsWith("en"));
}

/** Reads `text` aloud with the browser's built-in speech (free, works offline on most phones). */
export function SpeakButton({ text, label, size = "md" }: { text: string; label: string; size?: "sm" | "md" }) {
  const supported = useSpeechSupported();
  if (!supported) return null;

  function speak() {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.rate = 0.9;
    synth.speak(u);
  }

  const box = size === "sm" ? "h-8 w-8" : "h-11 w-11";
  return (
    <button
      type="button"
      onClick={speak}
      aria-label={label}
      title={label}
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full border border-border text-muted hover:border-accent hover:text-accent`}
    >
      <svg viewBox="0 0 24 24" width={size === "sm" ? 16 : 20} height={size === "sm" ? 16 : 20} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H3v6h3l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  );
}
