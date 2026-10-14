import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

function limiterWithClock(rules: Parameters<typeof createRateLimiter>[0]) {
  let time = 0;
  const check = createRateLimiter(rules, () => time);
  return { check, advance: (ms: number) => (time += ms) };
}

describe("rate limiter", () => {
  it("allows requests up to the limit, then blocks with a retry time", () => {
    const { check } = limiterWithClock([{ limit: 3, windowMs: 60_000 }]);

    expect([check("a"), check("a"), check("a")].every((result) => result.allowed)).toBe(true);
    expect(check("a")).toEqual({ allowed: false, retryAfterSeconds: 60 });
  });

  it("allows requests again once the window slides past old ones", () => {
    const { check, advance } = limiterWithClock([{ limit: 2, windowMs: 60_000 }]);
    check("a");
    advance(30_000);
    check("a");

    advance(29_000);
    expect(check("a")).toEqual({ allowed: false, retryAfterSeconds: 1 });
    advance(1_000);
    expect(check("a").allowed).toBe(true);
  });

  it("tracks visitors separately", () => {
    const { check } = limiterWithClock([{ limit: 1, windowMs: 60_000 }]);

    expect(check("a").allowed).toBe(true);
    expect(check("b").allowed).toBe(true);
    expect(check("a").allowed).toBe(false);
  });

  it("enforces the daily limit even when the per-minute limit is fine", () => {
    const { check, advance } = limiterWithClock([
      { limit: 10, windowMs: 60_000 },
      { limit: 3, windowMs: 86_400_000 }
    ]);
    for (let i = 0; i < 3; i += 1) {
      expect(check("a").allowed).toBe(true);
      advance(120_000);
    }

    const blocked = check("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.allowed === false && blocked.retryAfterSeconds).toBe(86_400 - 360);
  });

  it("does not count blocked requests against the visitor", () => {
    const { check, advance } = limiterWithClock([{ limit: 1, windowMs: 60_000 }]);
    check("a");
    for (let i = 0; i < 5; i += 1) check("a");

    advance(60_000);
    expect(check("a").allowed).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the first x-forwarded-for address", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then a shared key", () => {
    expect(clientKey(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});
