/**
 * Result Cache Implementation
 *
 * Manages cached agent execution results for idempotency.
 * Implements cache lookup, write, and eviction policies.
 */
import database from "../db";
import type { AguiResponse } from "./types";

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  // Default TTL: 24 hours
  DEFAULT_TTL_HOURS: 24,

  // Maximum TTL: 7 days
  MAX_TTL_HOURS: 168,

  // Minimum TTL: 1 hour
  MIN_TTL_HOURS: 1,
};

/**
 * Cache lookup result
 */
export interface CacheLookupResult {
  hit: boolean;
  response?: AguiResponse;
  age?: number; // Age in milliseconds
}

/**
 * ResultCache - manages cached agent execution results
 */
export class ResultCache {
  /**
   * Look up a cached response by intent signature
   *
   * @param intentSignature - SHA256 hash of stable job parameters
   * @param userId - User ID for multi-tenancy verification
   * @returns Cache lookup result
   */
  async lookup(
    intentSignature: string,
    userId: string
  ): Promise<CacheLookupResult> {
    try {
      const result = await database.queryRow<{
        response: any;
        created_at: Date;
        expires_at: Date;
        hit_count: number;
      }>`
        SELECT response, created_at, expires_at, hit_count
        FROM agent_result_cache
        WHERE intent_signature = ${intentSignature}
          AND user_id = ${userId}
          AND expires_at > NOW()
      `;

      if (!result) {
        return { hit: false };
      }

      // Update hit count and last accessed time
      await database.exec`
        UPDATE agent_result_cache
        SET hit_count = hit_count + 1,
            last_accessed_at = NOW()
        WHERE intent_signature = ${intentSignature}
      `;

      // Calculate age
      const age = Date.now() - result.created_at.getTime();

      return {
        hit: true,
        response: result.response as AguiResponse,
        age,
      };
    } catch (error) {
      // Log error but don't fail - cache miss is acceptable
      console.error("Cache lookup error:", error);
      return { hit: false };
    }
  }

  /**
   * Write a response to the cache
   *
   * @param intentSignature - SHA256 hash of stable job parameters
   * @param userId - User ID
   * @param response - The complete agent response to cache
   * @param ttlHours - Time to live in hours (default: 24)
   */
  async write(
    intentSignature: string,
    userId: string,
    response: AguiResponse,
    ttlHours: number = CACHE_CONFIG.DEFAULT_TTL_HOURS
  ): Promise<void> {
    try {
      // Validate TTL bounds
      const validTtl = Math.max(
        CACHE_CONFIG.MIN_TTL_HOURS,
        Math.min(ttlHours, CACHE_CONFIG.MAX_TTL_HOURS)
      );

      // Calculate expiration time
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + validTtl);

      // Insert or update cache entry
      await database.exec`
        INSERT INTO agent_result_cache (
          intent_signature,
          user_id,
          response,
          expires_at,
          hit_count,
          created_at,
          last_accessed_at
        ) VALUES (
          ${intentSignature},
          ${userId},
          ${JSON.stringify(response)},
          ${expiresAt},
          0,
          NOW(),
          NOW()
        )
        ON CONFLICT (intent_signature)
        DO UPDATE SET
          response = EXCLUDED.response,
          expires_at = EXCLUDED.expires_at,
          hit_count = 0,
          created_at = NOW(),
          last_accessed_at = NOW()
      `;
    } catch (error) {
      // Log error but don't fail the execution
      console.error("Cache write error:", error);
      throw new Error(`Failed to write to cache: ${error}`);
    }
  }

  /**
   * Invalidate a specific cache entry
   *
   * @param intentSignature - Signature to invalidate
   * @param userId - User ID for verification
   */
  async invalidate(intentSignature: string, userId: string): Promise<boolean> {
    try {
      const result = await database.exec`
        DELETE FROM agent_result_cache
        WHERE intent_signature = ${intentSignature}
          AND user_id = ${userId}
      `;

      return true;
    } catch (error) {
      console.error("Cache invalidation error:", error);
      return false;
    }
  }

  /**
   * Invalidate all cache entries for a user
   *
   * @param userId - User ID
   */
  async invalidateUserCache(userId: string): Promise<number> {
    try {
      const result = await database.exec`
        DELETE FROM agent_result_cache
        WHERE user_id = ${userId}
      `;

      return 0; // Return count of deleted entries if available
    } catch (error) {
      console.error("User cache invalidation error:", error);
      return 0;
    }
  }

  /**
   * Clean expired cache entries
   * Should be called periodically (e.g., via cron job)
   *
   * @returns Number of entries cleaned
   */
  async cleanExpired(): Promise<number> {
    try {
      const result = await database.queryRow<{ deleted_count: number }>`
        SELECT clean_expired_cache() as deleted_count
      `;

      return result?.deleted_count ?? 0;
    } catch (error) {
      console.error("Cache cleanup error:", error);
      return 0;
    }
  }

  /**
   * Get cache statistics for a user
   *
   * @param userId - User ID
   */
  async getStats(userId: string): Promise<{
    totalEntries: number;
    totalHits: number;
    avgHitCount: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  }> {
    try {
      const result = await database.queryRow<{
        total_entries: number;
        total_hits: number;
        avg_hit_count: number;
        oldest_entry: Date | null;
        newest_entry: Date | null;
      }>`
        SELECT
          COUNT(*) as total_entries,
          COALESCE(SUM(hit_count), 0) as total_hits,
          COALESCE(AVG(hit_count), 0) as avg_hit_count,
          MIN(created_at) as oldest_entry,
          MAX(created_at) as newest_entry
        FROM agent_result_cache
        WHERE user_id = ${userId}
          AND expires_at > NOW()
      `;

      if (!result) {
        return {
          totalEntries: 0,
          totalHits: 0,
          avgHitCount: 0,
        };
      }

      return {
        totalEntries: Number(result.total_entries),
        totalHits: Number(result.total_hits),
        avgHitCount: Number(result.avg_hit_count),
        oldestEntry: result.oldest_entry ?? undefined,
        newestEntry: result.newest_entry ?? undefined,
      };
    } catch (error) {
      console.error("Cache stats error:", error);
      return {
        totalEntries: 0,
        totalHits: 0,
        avgHitCount: 0,
      };
    }
  }

  /**
   * Check if cache is healthy (can read/write)
   *
   * @returns True if cache is operational
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try a simple query
      const result = await database.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM agent_result_cache
        LIMIT 1
      `;

      return result !== null;
    } catch (error) {
      console.error("Cache health check failed:", error);
      return false;
    }
  }
}

/**
 * Singleton instance
 */
export const resultCache = new ResultCache();
