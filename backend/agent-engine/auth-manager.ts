/**
 * Auth Manager
 *
 * Manages user tier lookup and policy constraints.
 * Loads policies from agent_user_policies table.
 * Creates default policies based on user tier if not found.
 */
import database from "../db";
import type { PolicyConstraints, UserTier, ToolName } from "./types";
import { UserTierSchema } from "./schemas";

/**
 * Default policy configurations by tier
 */
export const DEFAULT_POLICIES: Record<UserTier, PolicyConstraints> = {
  free: {
    maxRecursionDepth: 5,
    contextWindowLimit: 8000,
    maxToolCalls: 10,
    allowedTools: [],
    rateLimit: {
      requestsPerMinute: 10,
      requestsPerHour: 100,
    },
  },
  pro: {
    maxRecursionDepth: 10,
    contextWindowLimit: 16000,
    maxToolCalls: 25,
    allowedTools: [],
    rateLimit: {
      requestsPerMinute: 30,
      requestsPerHour: 500,
    },
  },
  enterprise: {
    maxRecursionDepth: 20,
    contextWindowLimit: 128000,
    maxToolCalls: 100,
    allowedTools: [],
    rateLimit: {
      requestsPerMinute: 100,
      requestsPerHour: 2000,
    },
  },
};

/**
 * Auth Manager Configuration
 */
export const AUTH_CONFIG = {
  DEFAULT_TIER: "free" as UserTier,
};

/**
 * Database row type for agent_user_policies
 */
interface UserPolicyRow {
  user_id: string;
  tier: string;
  max_recursion_depth: number;
  context_window_limit: number;
  max_tool_calls: number;
  allowed_tools: any; // JSONB
  requests_per_minute: number;
  requests_per_hour: number;
}

/**
 * Auth Manager - handles user tier lookup and policy constraints
 */
export class AuthManager {
  /**
   * Get user policy from database or create default if not found
   *
   * @param userId - User ID
   * @returns Policy constraints for the user
   */
  async getUserPolicy(userId: string): Promise<PolicyConstraints> {
    try {
      // Try to fetch existing policy
      const row = await database.queryRow<UserPolicyRow>`
        SELECT
          user_id,
          tier,
          max_recursion_depth,
          context_window_limit,
          max_tool_calls,
          allowed_tools,
          requests_per_minute,
          requests_per_hour
        FROM agent_user_policies
        WHERE user_id = ${userId}
      `;

      if (row) {
        // Parse allowed_tools from JSONB
        const allowedTools = Array.isArray(row.allowed_tools)
          ? (row.allowed_tools as ToolName[])
          : [];

        return {
          maxRecursionDepth: row.max_recursion_depth,
          contextWindowLimit: row.context_window_limit,
          maxToolCalls: row.max_tool_calls,
          allowedTools,
          rateLimit: {
            requestsPerMinute: row.requests_per_minute,
            requestsPerHour: row.requests_per_hour,
          },
        };
      }

      // User not found - create default policy
      const tier = AUTH_CONFIG.DEFAULT_TIER;
      await this.createDefaultPolicy(userId, tier);

      // Return the default policy
      return DEFAULT_POLICIES[tier];
    } catch (error) {
      console.error("Failed to get user policy:", error);

      // Fallback to free tier policy
      return DEFAULT_POLICIES.free;
    }
  }

  /**
   * Create default policy for user based on tier
   *
   * @param userId - User ID
   * @param tier - User tier (free, pro, enterprise)
   */
  async createDefaultPolicy(userId: string, tier: UserTier): Promise<void> {
    try {
      const policy = DEFAULT_POLICIES[tier];

      await database.exec`
        INSERT INTO agent_user_policies (
          user_id,
          tier,
          max_recursion_depth,
          context_window_limit,
          max_tool_calls,
          allowed_tools,
          requests_per_minute,
          requests_per_hour
        ) VALUES (
          ${userId},
          ${tier},
          ${policy.maxRecursionDepth},
          ${policy.contextWindowLimit},
          ${policy.maxToolCalls},
          ${JSON.stringify(policy.allowedTools)},
          ${policy.rateLimit.requestsPerMinute},
          ${policy.rateLimit.requestsPerHour}
        )
        ON CONFLICT (user_id) DO NOTHING
      `;
    } catch (error) {
      console.error("Failed to create default policy:", error);
      throw error;
    }
  }

  /**
   * Update user tier and policy
   *
   * @param userId - User ID
   * @param tier - New user tier
   */
  async updateUserTier(userId: string, tier: UserTier): Promise<void> {
    try {
      // Validate tier
      UserTierSchema.parse(tier);

      const policy = DEFAULT_POLICIES[tier];

      await database.exec`
        UPDATE agent_user_policies
        SET
          tier = ${tier},
          max_recursion_depth = ${policy.maxRecursionDepth},
          context_window_limit = ${policy.contextWindowLimit},
          max_tool_calls = ${policy.maxToolCalls},
          requests_per_minute = ${policy.rateLimit.requestsPerMinute},
          requests_per_hour = ${policy.rateLimit.requestsPerHour}
        WHERE user_id = ${userId}
      `;

      // If user doesn't exist, create new policy
      const result = await database.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM agent_user_policies
        WHERE user_id = ${userId}
      `;

      if (!result || result.count === 0) {
        await this.createDefaultPolicy(userId, tier);
      }
    } catch (error) {
      console.error("Failed to update user tier:", error);
      throw error;
    }
  }

  /**
   * Get user tier
   *
   * @param userId - User ID
   * @returns User tier
   */
  async getUserTier(userId: string): Promise<UserTier> {
    try {
      const row = await database.queryRow<{ tier: string }>`
        SELECT tier
        FROM agent_user_policies
        WHERE user_id = ${userId}
      `;

      if (row) {
        return UserTierSchema.parse(row.tier);
      }

      // User not found - return default tier
      return AUTH_CONFIG.DEFAULT_TIER;
    } catch (error) {
      console.error("Failed to get user tier:", error);
      return AUTH_CONFIG.DEFAULT_TIER;
    }
  }
}

/**
 * Singleton instance
 */
export const authManager = new AuthManager();
