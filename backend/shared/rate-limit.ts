import { APIError } from "encore.dev/api";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(key: string, config: RateLimitConfig): void {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now >= entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return;
  }

  if (entry.count >= config.maxRequests) {
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);
    throw APIError.resourceExhausted("Rate limit exceeded").withDetails({
      retryAfter: `${retryAfterSeconds}s`,
      limit: config.maxRequests,
      window: `${config.windowMs / 1000}s`,
    });
  }

  entry.count++;
}

export const defaultRateLimit: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 100,
};

export const strictRateLimit: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 10,
};
