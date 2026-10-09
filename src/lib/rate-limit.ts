import { createHash } from "node:crypto";

const AUTH_RATE_LIMIT = 10;
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;

// This limiter is per process instance; it is not shared across Vercel instances.
export class InMemoryRateLimiter {
  private readonly attempts = new Map<string, { count: number; expiresAt: number }>();
  private lastCleanup = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  consume(key: string): number | null {
    const currentTime = this.now();
    if (this.attempts.size > 1000 && currentTime - this.lastCleanup > 60_000) {
      this.lastCleanup = currentTime;
      for (const [attemptKey, attempt] of this.attempts) {
        if (attempt.expiresAt <= currentTime) this.attempts.delete(attemptKey);
      }
    }
    const current = this.attempts.get(key);
    if (!current || current.expiresAt <= currentTime) {
      this.attempts.set(key, {
        count: 1,
        expiresAt: currentTime + this.windowMs,
      });
      return null;
    }
    if (current.count >= this.limit) {
      return Math.max(1, Math.ceil((current.expiresAt - currentTime) / 1000));
    }
    current.count += 1;
    return null;
  }
}

const authRateLimiter = new InMemoryRateLimiter(
  AUTH_RATE_LIMIT,
  AUTH_RATE_WINDOW_MS,
);

export function checkAuthRateLimit(
  request: Request,
  email: string,
): number | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const key = createHash("sha256")
    .update(`${ip}\0${email.trim().toLowerCase()}`)
    .digest("hex");
  return authRateLimiter.consume(key);
}
