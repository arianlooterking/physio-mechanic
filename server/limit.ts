/**
 * A small fixed-window rate limiter kept in memory. It lives in one Worker isolate (or one
 * serverless instance), so limits are per instance and best effort, with no storage writes:
 * enough to stop bursts and runaway loops, not a determined attacker spread over many locations.
 */
export function windowLimiter(max: number, windowMs: number, maxKeys = 5000) {
  const hits = new Map<string, { n: number; start: number }>();
  return {
    /** Count a hit; true when the key has gone over the limit in its current window. */
    hit(key: string, now = Date.now()): boolean {
      const h = hits.get(key);
      if (!h || now - h.start >= windowMs) {
        hits.set(key, { n: 1, start: now });
        if (hits.size > maxKeys) {
          for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
        }
        return max < 1;
      }
      h.n += 1;
      return h.n > max;
    },
    /** Whole seconds until the key's window ends (at least 1). */
    retryAfter(key: string, now = Date.now()): number {
      const h = hits.get(key);
      return h ? Math.max(1, Math.ceil((h.start + windowMs - now) / 1000)) : 1;
    },
    /** Forget every count (tests). */
    reset(): void {
      hits.clear();
    },
  };
}

export type WindowLimiter = ReturnType<typeof windowLimiter>;
