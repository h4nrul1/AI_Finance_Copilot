/**
 * In-memory sliding-window rate limiter.
 *
 * Counts live in this server instance's memory, so on Vercel each running instance keeps its own counts and they
 * reset on cold starts. That makes the limit approximate: good enough to stop casual abuse of the OpenAI key in a
 * pilot. Swap in a shared store (e.g. Upstash Redis) or per-user limits once accounts exist.
 */

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

const MAX_TRACKED_KEYS = 10_000;

export function createRateLimiter(rules: RateLimitRule[], now: () => number = Date.now) {
  const longestWindow = Math.max(...rules.map((rule) => rule.windowMs));
  const hits = new Map<string, number[]>();

  function prune(timestamps: number[], at: number) {
    return timestamps.filter((time) => at - time < longestWindow);
  }

  return function check(key: string): RateLimitResult {
    const at = now();
    const timestamps = prune(hits.get(key) ?? [], at);

    for (const rule of rules) {
      const inWindow = timestamps.filter((time) => at - time < rule.windowMs);
      if (inWindow.length >= rule.limit) {
        hits.set(key, timestamps);
        const oldest = inWindow[0];
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + rule.windowMs - at) / 1000)) };
      }
    }

    timestamps.push(at);
    hits.set(key, timestamps);

    // Bound memory: when too many visitors are tracked, drop the ones with no recent activity.
    if (hits.size > MAX_TRACKED_KEYS) {
      for (const [trackedKey, trackedTimes] of hits) {
        const recent = prune(trackedTimes, at);
        if (recent.length === 0) hits.delete(trackedKey);
        else hits.set(trackedKey, recent);
      }
    }

    return { allowed: true };
  };
}

/** Best-effort client IP. Vercel and most proxies put the original client first in x-forwarded-for. */
export function clientKey(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
