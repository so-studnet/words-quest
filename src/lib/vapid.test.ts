import webpush from "web-push";
import { describe, expect, it } from "vitest";
import { generateCronSecret, generateVapidKeys } from "./vapid";

describe("generateVapidKeys", () => {
  it("makes keys that web-push accepts", async () => {
    const { publicKey, privateKey } = await generateVapidKeys();
    expect(publicKey).toMatch(/^[A-Za-z0-9_-]{87}$/); // 65 bytes
    expect(privateKey).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes
    // Throws if either key is malformed.
    expect(() => webpush.setVapidDetails("mailto:me@example.com", publicKey, privateKey)).not.toThrow();
    const headers = webpush.getVapidHeaders("https://push.example.com", "mailto:me@example.com", publicKey, privateKey, "aes128gcm");
    expect(headers.Authorization).toMatch(/^vapid t=.+, k=/);
  });
  it("makes different keys each time", async () => {
    const a = await generateVapidKeys();
    const b = await generateVapidKeys();
    expect(a.privateKey).not.toBe(b.privateKey);
  });
});

describe("generateCronSecret", () => {
  it("is 64 hex characters and random", () => {
    const s = generateCronSecret();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
    expect(generateCronSecret()).not.toBe(s);
  });
});
