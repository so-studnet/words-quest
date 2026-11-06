/**
 * Word of the Day (pure). The same date always gives the same word. The list is
 * shuffled once and then walked in a circle, so any run of WORDS.length days has
 * no repeats.
 */
import { daysBetween } from "./study";

/** Useful upper-intermediate / advanced words. Order does not matter (they are shuffled). */
export const WORDS = [
  "abundant", "accommodate", "acknowledge", "adamant", "adversity", "advocate", "aesthetic", "affluent",
  "alleviate", "ambiguous", "ambivalent", "amiable", "anecdote", "apprehensive", "arbitrary", "articulate",
  "aspire", "assertive", "astute", "audacious", "authentic", "benevolent", "bewildered", "candid",
  "catalyst", "cautious", "coherent", "colleague", "compassion", "compelling", "complacent", "comprehensive",
  "concise", "consensus", "conspicuous", "contemplate", "convey", "cordial", "credible", "culminate",
  "curiosity", "daunting", "debris", "decisive", "deliberate", "delicate", "demeanor", "diligent",
  "discern", "dismay", "distinct", "diverse", "dwindle", "eloquent", "elusive", "embark",
  "embrace", "eminent", "empathy", "endeavor", "endorse", "enhance", "enigma", "ephemeral",
  "epitome", "equivalent", "eradicate", "essential", "evoke", "exemplary", "exhilarating", "explicit",
  "facilitate", "feasible", "fervent", "flourish", "fluctuate", "formidable", "fortitude", "frugal",
  "futile", "genuine", "gratitude", "gregarious", "hamper", "hesitant", "hinder", "humble",
  "hypothesis", "imminent", "impeccable", "impetus", "implement", "implicit", "incentive", "indifferent",
  "inevitable", "ingenious", "inherent", "innovative", "insight", "integrity", "intricate", "intuitive",
  "jeopardize", "jubilant", "keen", "lenient", "lucid", "meticulous", "mitigate", "modest",
  "momentum", "mundane", "negligible", "nonchalant", "nostalgia", "notorious", "novice", "nuance",
  "oblivious", "obsolete", "obstinate", "optimistic", "ostentatious", "paradox", "paramount", "perceive",
  "perseverance", "persistent", "pertinent", "phenomenon", "plausible", "pragmatic", "precarious", "prevalent",
  "profound", "proficient", "prominent", "prudent", "quaint", "rapport", "rational", "reconcile",
  "redundant", "reluctant", "remedy", "renowned", "resilient", "resolute", "retain", "reverence",
  "robust", "scrutinize", "serendipity", "serene", "skeptical", "sophisticated", "spontaneous", "stagnant",
  "subtle", "succinct", "superficial", "sustain", "tangible", "tedious", "tenacious", "tentative",
  "thrive", "tranquil", "transient", "trivial", "ubiquitous", "undermine", "unprecedented", "versatile",
  "viable", "vigilant", "vivid", "vulnerable", "whimsical", "wholesome", "zealous", "zenith",
] as const;

/** Day 0 of the rotation. */
const EPOCH = "2026-01-01";

/** Small deterministic PRNG so the shuffle is the same everywhere. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const SEED = 0x5eed;
const ORDER = shuffled(WORDS, SEED);

export function wordOfTheDay(date: string, words: readonly string[] = WORDS): string {
  const order = words === WORDS ? ORDER : shuffled(words, SEED);
  const n = order.length;
  const day = daysBetween(EPOCH, date);
  return order[((day % n) + n) % n];
}
