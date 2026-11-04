import { describe, expect, it } from "vitest";
import { GroqProvider, providerFromEnv } from "./groq";

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const msgs = [{ role: "user" as const, content: "hi" }];

describe("GroqProvider", () => {
  it("sends a JSON-mode chat request and returns the content", async () => {
    const f = fakeFetch(200, { choices: [{ message: { content: '{"ok":1}' } }] });
    const p = new GroqProvider("gsk_test", "openai/gpt-oss-120b", f.impl);
    expect(await p.complete(msgs)).toBe('{"ok":1}');
    const body = JSON.parse(String(f.calls[0].init.body));
    expect(f.calls[0].url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((f.calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer gsk_test");
    expect(body).toMatchObject({ model: "openai/gpt-oss-120b", response_format: { type: "json_object" }, reasoning_effort: "low" });
  });

  it("omits reasoning_effort for other models", async () => {
    const f = fakeFetch(200, { choices: [{ message: { content: "{}" } }] });
    await new GroqProvider("k", "llama-3.3-70b-versatile", f.impl).complete(msgs);
    expect(JSON.parse(String(f.calls[0].init.body)).reasoning_effort).toBeUndefined();
  });

  it.each([
    [429, "rate_limited"],
    [401, "not_configured"],
    [500, "upstream_error"],
    [400, "upstream_error"],
  ])("maps HTTP %i to %s", async (status, code) => {
    const p = new GroqProvider("k", "m", fakeFetch(status, "err").impl);
    await expect(p.complete(msgs)).rejects.toMatchObject({ code });
  });

  it("fails on a reply without content", async () => {
    const p = new GroqProvider("k", "m", fakeFetch(200, { choices: [] }).impl);
    await expect(p.complete(msgs)).rejects.toMatchObject({ code: "upstream_error" });
  });

  it("fails on a network error", async () => {
    const impl = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(new GroqProvider("k", "m", impl).complete(msgs)).rejects.toMatchObject({ code: "upstream_error" });
  });
});

describe("providerFromEnv", () => {
  it("returns null without a key and uses GROQ_MODEL when set", () => {
    expect(providerFromEnv({})).toBeNull();
    expect(providerFromEnv({ GROQ_API_KEY: "  " })).toBeNull();
    expect(providerFromEnv({ GROQ_API_KEY: "k" })?.model).toBe("openai/gpt-oss-120b");
    expect(providerFromEnv({ GROQ_API_KEY: "k", GROQ_MODEL: "x" })?.model).toBe("x");
  });
});
