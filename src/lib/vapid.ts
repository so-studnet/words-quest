/**
 * VAPID key pair for Web Push, made with Web Crypto (works in browsers and Node 20+).
 * Same format as `npx web-push generate-vapid-keys`: URL-safe base64 of the
 * uncompressed P-256 public point (65 bytes) and the private scalar (32 bytes).
 */

export function bytesToBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(v: string): Uint8Array {
  const b64 = (v + "=".repeat((4 - (v.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  if (!jwk.x || !jwk.y || !jwk.d) throw new Error("Unexpected key format");
  const point = new Uint8Array(65);
  point[0] = 0x04;
  point.set(base64UrlToBytes(jwk.x), 1);
  point.set(base64UrlToBytes(jwk.y), 33);
  return { publicKey: bytesToBase64Url(point), privateKey: jwk.d };
}

/** 32 random bytes as hex. */
export function generateCronSecret(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
