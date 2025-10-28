/**
 * Rate Limiter
 *
 * Implements rate limiting using a sliding window algorithm.
 * Uses in-memory counters for fast checks, periodically syncs to DB.
 */
import database from "../db";

/**
 * Rate limiter configuration
 */
export const RATE_LIMITER_CONFIG = {
  // How long to keep counters in memory (milliseconds)
  MEMORY_TTL: 60 * 60 * 1000, // 1 hour

  // How often to sync counters to database (milliseconds)
  SYNC_INTERVAL: 5 * 60 * 1000, // 5 minutes

  // Cleanup interval for expired counters
  CLEANUP_INTERVAL: 10 * 60 * 1000, // 10 minutes
};

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  remaining?: {
    perMinute: number;
    perHour: number;
  };
}

/**
 * Time window counter
 */
interface TimeWindowCounter {
  count: number;
  windowStart: number;
}

/**
 * User rate limit state
 */
interface UserRateLimitState {
  minuteCounter: TimeWindowCounter;
  hourCounter: TimeWindowCounter;
  lastUpdated: number;
}

/**
 * Rate Limiter - implements sliding window rate limiting
 */
export class RateLimiter {
  // In-memory storage for rate limit counters
  private counters: Map<string, UserRateLimitState> = new Map();

  // Cleanup interval reference
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Check if user is within rate limits
   *
   * @param userId - User ID
   * @param limits - Rate limit configuration
   * @returns Rate limit check result
   */
  async checkRateLimit(
    userId: string,
    limits: { requestsPerMinute: number; requestsPerHour: number }
  ): Promise<RateLimitResult> {
    try {
      // Get or create user state
      const state = this.getUserState(userId);

      const now = Date.now();
      const oneMinuteAgo = now - 60 * 1000;
      const oneHourAgo = now - 60 * 60 * 1000;

      // Clean up expired windows
      if (state.minuteCounter.windowStart < oneMinuteAgo) {
        state.minuteCounter = { count: 0, windowStart: now };
      }

      if (state.hourCounter.windowStart < oneHourAgo) {
        state.hourCounter = { count: 0, windowStart: now };
      }

      // Check minute limit
      if (state.minuteCounter.count >= limits.requestsPerMinute) {
        const resetIn = Math.ceil(
          (state.minuteCounter.windowStart + 60 * 1000 - now) / 1000
        );

        return {
          allowed: false,
          reason: `Rate limit exceeded: ${limits.requestsPerMinute} requests per minute. Resets in ${resetIn}s.`,
        };
      }

      // Check hour limit
      if (state.hourCounter.count >= limits.requestsPerHour) {
        const resetIn = Math.ceil(
          (state.hourCounter.windowStart + 60 * 60 * 1000 - now) / 1000
        );

        return {
          allowed: false,
          reason: `Rate limit exceeded: ${limits.requestsPerHour} requests per hour. Resets in ${resetIn}s.`,
        };
      }

      // Calculate remaining
      const remaining = {
        perMinute: limits.requestsPerMinute - state.minuteCounter.count,
        perHour: limits.requestsPerHour - state.hourCounter.count,
      };

      return {
        allowed: true,
        remaining,
      };
    } catch (error) {
      console.error("Rate limit check error:", error);

      // On error, allow the request (fail open)
      return {
        allowed: true,
      };
    }
  }

  /**
   * Increment rate limit counter
   *
   * @param userId - User ID
   */
  async incrementCounter(userId: string): Promise<void> {
    try {
      const state = this.getUserState(userId);
      const now = Date.now();

      // Increment counters
      state.minuteCounter.count++;
      state.hourCounter.count++;
      state.lastUpdated = now;

      // Update in-memory state
      this.counters.set(userId, state);

      // Optionally persist to database for durability
      await this.persistCounter(userId, state);
    } catch (error) {
      console.error("Failed to increment counter:", error);
      // Don't throw - rate limiting should be resilient
    }
  }

  /**
   * Reset counters for a user
   *
   * @param userId - User ID
   */
  async resetCounters(userId: string): Promise<void> {
    try {
      const now = Date.now();

      const state: UserRateLimitState = {
        minuteCounter: { count: 0, windowStart: now },
        hourCounter: { count: 0, windowStart: now },
        lastUpdated: now,
      };

      this.counters.set(userId, state);

      // Also reset in database
      await database.exec`
        DELETE FROM agent_rate_limits
        WHERE user_id = ${userId}
      `;
    } catch (error) {
      console.error("Failed to reset counters:", error);
    }
  }

  /**
   * Get user state from memory or create new
   *
   * @param userId - User ID
   * @returns User rate limit state
   */
  private getUserState(userId: string): UserRateLimitState {
    let state = this.counters.get(userId);

    if (!state) {
      const now = Date.now();
      state = {
        minuteCounter: { count: 0, windowStart: now },
        hourCounter: { count: 0, windowStart: now },
        lastUpdated: now,
      };
      this.counters.set(userId, state);
    }

    return state;
  }

  /**
   * Persist counter to database
   *
   * @param userId - User ID
   * @param state - User rate limit state
   */
  private async persistCounter(
    userId: string,
    state: UserRateLimitState
  ): Promise<void> {
    try {
      // Create table if it doesn't exist (should be in migrations)
      await database.exec`
        CREATE TABLE IF NOT EXISTS agent_rate_limits (
          user_id VARCHAR(255) PRIMARY KEY,
          minute_count INTEGER DEFAULT 0,
          minute_window_start TIMESTAMP,
          hour_count INTEGER DEFAULT 0,
          hour_window_start TIMESTAMP,
          last_updated TIMESTAMP DEFAULT NOW()
        )
      `;

      await database.exec`
        INSERT INTO agent_rate_limits (
          user_id,
          minute_count,
          minute_window_start,
          hour_count,
          hour_window_start,
          last_updated
        ) VALUES (
          ${userId},
          ${state.minuteCounter.count},
          ${new Date(state.minuteCounter.windowStart)},
          ${state.hourCounter.count},
          ${new Date(state.hourCounter.windowStart)},
          ${new Date(state.lastUpdated)}
        )
        ON CONFLICT (user_id) DO UPDATE SET
          minute_count = ${state.minuteCounter.count},
          minute_window_start = ${new Date(state.minuteCounter.windowStart)},
          hour_count = ${state.hourCounter.count},
          hour_window_start = ${new Date(state.hourCounter.windowStart)},
          last_updated = ${new Date(state.lastUpdated)}
      `;
    } catch (error) {
      // Don't throw - persistence is best effort
      console.error("Failed to persist rate limit counter:", error);
    }
  }

  /**
   * Start periodic cleanup of expired counters
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredCounters();
    }, RATE_LIMITER_CONFIG.CLEANUP_INTERVAL);
  }

  /**
   * Clean up expired counters from memory
   */
  private cleanupExpiredCounters(): void {
    const now = Date.now();
    const expireThreshold = now - RATE_LIMITER_CONFIG.MEMORY_TTL;

    for (const [userId, state] of this.counters.entries()) {
      if (state.lastUpdated < expireThreshold) {
        this.counters.delete(userId);
      }
    }
  }

  /**
   * Stop cleanup interval (for testing)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}

/**
 * Singleton instance
 */
export const rateLimiter = new RateLimiter();
