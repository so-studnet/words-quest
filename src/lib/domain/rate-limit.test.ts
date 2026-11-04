import { describe, expect, it } from "vitest";
import { clientIp, DEFAULT_LIMITS, limitsFromEnv, windowStart } from "./rate-limit";

describe("windowStart", () => {
  const now = new Date("2026-11-04T13:45:12.345Z");
  it("rounds down to the UTC hour", () => {
    expect(windowStart(now, "hour").toISOString()).toBe("2026-11-04T13:00:00.000Z");
  });
  it("rounds down to the UTC day", () => {
    expect(windowStart(now, "day").toISOString()).toBe("2026-11-04T00:00:00.000Z");
  });
  it("keeps exact boundaries and does not change the input", () => {
    const b = new Date("2026-11-04T00:00:00.000Z");
    expect(windowStart(b, "day").getTime()).toBe(b.getTime());
    expect(now.toISOString()).toBe("2026-11-04T13:45:12.345Z");
  });
});

describe("clientIp", () => {
  it("uses the first x-forwarded-for entry", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
  });
  it("falls back to x-real-ip, then unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers({ "x-forwarded-for": " " }))).toBe("unknown");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("limitsFromEnv", () => {
  it("uses defaults when unset or invalid", () => {
    expect(limitsFromEnv({})).toEqual(DEFAULT_LIMITS);
    expect(limitsFromEnv({ RATE_LIMIT_PER_HOUR: "abc", AI_DAILY_LIMIT: "-1" })).toEqual(DEFAULT_LIMITS);
    expect(limitsFromEnv({ RATE_LIMIT_PER_HOUR: "1.5" }).perIpPerHour).toBe(DEFAULT_LIMITS.perIpPerHour);
  });
  it("reads valid values, including 0", () => {
    expect(limitsFromEnv({ RATE_LIMIT_PER_HOUR: "10", AI_DAILY_LIMIT: "0" })).toEqual({ perIpPerHour: 10, aiPerDay: 0 });
  });
});
