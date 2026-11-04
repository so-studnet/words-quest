import { describe, expect, it } from "vitest";
import { AiProviderError, type AiProvider } from "@/lib/ai/provider";
import { parseQuery, type ParsedQuery } from "@/lib/domain/query";
import { lookup } from "./lookup";

const query = (parseQuery("happy") as { ok: true; query: ParsedQuery }).query;
const valid = JSON.stringify({ senses: [{ partOfSpeech: "adjective", definition: "Feeling pleasure." }] });

function fake(replies: (string | Error)[]): AiProvider & { calls: number } {
  return {
    name: "fake",
    model: "fake-1",
    calls: 0,
    async complete() {
      const r = replies[Math.min(this.calls++, replies.length - 1)];
      if (r instanceof Error) throw r;
      return r;
    },
  };
}

describe("lookup", () => {
  it("returns not_configured without a provider", async () => {
    expect(await lookup(query, null)).toMatchObject({ ok: false, error: "not_configured" });
  });

  it("returns the validated result", async () => {
    const r = await lookup(query, fake([valid]));
    expect(r.ok && r.result.senses[0].definition).toBe("Feeling pleasure.");
  });

  it("retries once on an invalid answer", async () => {
    const p = fake(["oops", valid]);
    expect((await lookup(query, p)).ok).toBe(true);
    expect(p.calls).toBe(2);
  });

  it("gives up after the retry", async () => {
    const p = fake(["oops", "still oops", valid]);
    expect(await lookup(query, p)).toMatchObject({ ok: false, error: "invalid_response" });
    expect(p.calls).toBe(2);
  });

  it("does not retry not_found", async () => {
    const p = fake(['{"found": false}', valid]);
    expect(await lookup(query, p)).toMatchObject({ ok: false, error: "not_found" });
    expect(p.calls).toBe(1);
  });

  it("maps provider errors", async () => {
    const r = await lookup(query, fake([new AiProviderError("rate_limited", "429")]));
    expect(r).toMatchObject({ ok: false, error: "rate_limited" });
    const r2 = await lookup(query, fake([new Error("boom")]));
    expect(r2).toMatchObject({ ok: false, error: "upstream_error" });
  });
});
