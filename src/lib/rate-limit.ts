import { createHash } from "node:crypto";

const AUTH_RATE_LIMIT = 10;
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_RATE_LIMIT_KEYS = 10_000;

// Best-effort per-process protection. This is neither shared across instances
// nor an IP-based limiter: this deployment has no trusted client-IP source
// configured in the repository. At capacity, expired entries are removed and
// then the least recently used entry is evicted to keep the process available.
export class InMemoryRateLimiter {
  private readonly attempts = new Map<
    string,
    { count: number; inFlight: number; expiresAt: number }
  >();
  private lastCleanup = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly capacity = MAX_RATE_LIMIT_KEYS,
  ) {}

  get size() {
    return this.attempts.size;
  }

  private pruneExpired(currentTime: number) {
    if (currentTime - this.lastCleanup < 60_000) return;
    this.lastCleanup = currentTime;
    for (const [key, attempt] of this.attempts) {
      if (attempt.expiresAt <= currentTime && attempt.inFlight === 0) {
        this.attempts.delete(key);
      }
    }
  }

  private entry(key: string, currentTime: number) {
    const current = this.attempts.get(key);
    if (current && current.expiresAt > currentTime) {
      // Map insertion order is used as an LRU queue.
      this.attempts.delete(key);
      this.attempts.set(key, current);
      return current;
    }
    if (current) this.attempts.delete(key);

    if (this.attempts.size >= this.capacity) {
      for (const [candidateKey, candidate] of this.attempts) {
        if (candidate.expiresAt <= currentTime && candidate.inFlight === 0) {
          this.attempts.delete(candidateKey);
        }
      }
    }
    if (this.attempts.size >= this.capacity) {
      const leastRecentlyUsed = this.attempts.keys().next().value;
      if (leastRecentlyUsed !== undefined) this.attempts.delete(leastRecentlyUsed);
    }

    const created = {
      count: 0,
      inFlight: 0,
      expiresAt: currentTime + this.windowMs,
    };
    this.attempts.set(key, created);
    return created;
  }

  private retryAfter(attempt: { count: number; inFlight: number; expiresAt: number }, currentTime: number) {
    if (attempt.count + attempt.inFlight < this.limit) return null;
    return Math.max(1, Math.ceil((attempt.expiresAt - currentTime) / 1000));
  }

  consume(key: string): number | null {
    const currentTime = this.now();
    this.pruneExpired(currentTime);
    const attempt = this.entry(key, currentTime);
    const retryAfter = this.retryAfter(attempt, currentTime);
    if (retryAfter !== null) return retryAfter;
    attempt.count += 1;
    return null;
  }

  begin(key: string): { retryAfter: number | null; finish: (success: boolean) => void } {
    const currentTime = this.now();
    this.pruneExpired(currentTime);
    const attempt = this.entry(key, currentTime);
    const retryAfter = this.retryAfter(attempt, currentTime);
    if (retryAfter !== null) return { retryAfter, finish: () => undefined };

    attempt.inFlight += 1;
    let finished = false;
    return {
      retryAfter: null,
      finish: (success) => {
        if (finished) return;
        finished = true;
        // An expired or capacity-evicted entry may have been replaced while
        // the request was running. Never mutate that newer entry.
        if (this.attempts.get(key) !== attempt) return;
        attempt.inFlight = Math.max(0, attempt.inFlight - 1);
        if (!success) attempt.count += 1;
      },
    };
  }
}

const authRateLimiter = new InMemoryRateLimiter(
  AUTH_RATE_LIMIT,
  AUTH_RATE_WINDOW_MS,
);

export type AuthRateLimitScope = "login" | "account-creation";

export function authRateLimitIdentity(email: string, scope: AuthRateLimitScope) {
  // Forwarding headers are deliberately ignored until a trusted proxy source
  // is established for this deployment. Email is normalized and only its
  // digest is retained in memory.
  return createHash("sha256")
    .update(`${scope}\0${email.trim().toLowerCase()}`)
    .digest("hex");
}

export function checkAuthRateLimit(email: string): number | null {
  return authRateLimiter.consume(authRateLimitIdentity(email, "account-creation"));
}

export function beginLoginRateLimit(email: string) {
  return authRateLimiter.begin(authRateLimitIdentity(email, "login"));
}
