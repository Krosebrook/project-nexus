/**
 * Audit Logger
 *
 * Persists all critical events to the audit_logs table for the
 * Dynamic Context Debugger (DCD) - a monetized feature.
 *
 * All events are indexed by correlation ID for full chronological
 * audit history retrieval.
 */
import database from "../db";
import type { AuditLogEntry } from "./types";

/**
 * Audit Logger Configuration
 */
export const AUDIT_CONFIG = {
  // Batch size for bulk logging (future optimization)
  BATCH_SIZE: 100,

  // Retention period (days) by tier
  RETENTION: {
    free: 7,
    pro: 30,
    enterprise: 90,
  },
};

/**
 * AuditLogger - persists execution events for DCD
 */
export class AuditLogger {
  /**
   * Log a single audit event
   *
   * @param entry - Audit log entry
   */
  async log(
    entry: Omit<AuditLogEntry, "timestamp">
  ): Promise<void> {
    try {
      await database.exec`
        INSERT INTO agent_audit_logs (
          correlation_id,
          user_id,
          intent_signature,
          phase,
          event,
          details,
          timestamp
        ) VALUES (
          ${entry.correlationId},
          ${entry.userId},
          ${(entry as any).intentSignature || null},
          ${entry.phase},
          ${entry.event},
          ${JSON.stringify(entry.details)},
          NOW()
        )
      `;
    } catch (error) {
      // Don't throw - audit logging should never break execution
      // But log to console for monitoring
      console.error("Audit logging failed:", {
        correlationId: entry.correlationId,
        phase: entry.phase,
        event: entry.event,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Log multiple events in batch (future optimization)
   *
   * @param entries - Array of audit log entries
   */
  async logBatch(
    entries: Omit<AuditLogEntry, "timestamp">[]
  ): Promise<void> {
    if (entries.length === 0) return;

    try {
      // Build bulk insert query
      const values = entries.map(entry => `(
        '${entry.correlationId}',
        '${entry.userId}',
        ${(entry as any).intentSignature ? `'${(entry as any).intentSignature}'` : 'NULL'},
        '${entry.phase}',
        '${entry.event}',
        '${JSON.stringify(entry.details).replace(/'/g, "''")}',
        NOW()
      )`).join(',');

      await database.exec`
        INSERT INTO agent_audit_logs (
          correlation_id,
          user_id,
          intent_signature,
          phase,
          event,
          details,
          timestamp
        ) VALUES ${values}
      `;
    } catch (error) {
      console.error("Batch audit logging failed:", {
        count: entries.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Retrieve full audit trail for a correlation ID
   * This is the core of the Dynamic Context Debugger (DCD)
   *
   * @param correlationId - Correlation ID to retrieve
   * @param userId - User ID for access control
   * @returns Chronological list of audit events
   */
  async getAuditTrail(
    correlationId: string,
    userId: string
  ): Promise<AuditLogEntry[]> {
    try {
      const results = await database.query<{
        correlation_id: string;
        user_id: string;
        intent_signature: string | null;
        phase: string;
        event: string;
        details: any;
        timestamp: Date;
      }>`
        SELECT
          correlation_id,
          user_id,
          intent_signature,
          phase,
          event,
          details,
          timestamp
        FROM agent_audit_logs
        WHERE correlation_id = ${correlationId}
          AND user_id = ${userId}
        ORDER BY timestamp ASC
      `;

      return results.map((row) => ({
        correlationId: row.correlation_id,
        userId: row.user_id,
        timestamp: row.timestamp,
        phase: row.phase,
        event: row.event,
        details: row.details,
      }));
    } catch (error) {
      console.error("Failed to retrieve audit trail:", error);
      return [];
    }
  }

  /**
   * Get audit summary for a correlation ID
   * Useful for quick overview without full DCD access
   *
   * @param correlationId - Correlation ID
   * @param userId - User ID
   */
  async getAuditSummary(
    correlationId: string,
    userId: string
  ): Promise<{
    totalEvents: number;
    phases: string[];
    startTime?: Date;
    endTime?: Date;
    duration?: number;
  }> {
    try {
      const result = await database.queryRow<{
        total_events: number;
        phases: string;
        start_time: Date | null;
        end_time: Date | null;
      }>`
        SELECT
          COUNT(*) as total_events,
          STRING_AGG(DISTINCT phase, ',') as phases,
          MIN(timestamp) as start_time,
          MAX(timestamp) as end_time
        FROM agent_audit_logs
        WHERE correlation_id = ${correlationId}
          AND user_id = ${userId}
      `;

      if (!result) {
        return {
          totalEvents: 0,
          phases: [],
        };
      }

      const duration =
        result.start_time && result.end_time
          ? result.end_time.getTime() - result.start_time.getTime()
          : undefined;

      return {
        totalEvents: Number(result.total_events),
        phases: result.phases ? result.phases.split(",") : [],
        startTime: result.start_time ?? undefined,
        endTime: result.end_time ?? undefined,
        duration,
      };
    } catch (error) {
      console.error("Failed to get audit summary:", error);
      return {
        totalEvents: 0,
        phases: [],
      };
    }
  }

  /**
   * Clean old audit logs based on retention policy
   * Should be called periodically via cron
   *
   * @param retentionDays - Number of days to retain
   * @returns Number of logs deleted
   */
  async cleanOldLogs(retentionDays: number): Promise<number> {
    try {
      const result = await database.exec`
        DELETE FROM agent_audit_logs
        WHERE timestamp < NOW() - INTERVAL '${retentionDays} days'
      `;

      return 0; // Return count if available
    } catch (error) {
      console.error("Failed to clean old audit logs:", error);
      return 0;
    }
  }

  /**
   * Get audit statistics for a user
   *
   * @param userId - User ID
   * @param fromDate - Start date (optional)
   * @param toDate - End date (optional)
   */
  async getUserStats(
    userId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<{
    totalExecutions: number;
    totalEvents: number;
    phaseDistribution: Record<string, number>;
  }> {
    try {
      const result = await database.queryRow<{
        total_executions: number;
        total_events: number;
      }>`
        SELECT
          COUNT(DISTINCT correlation_id) as total_executions,
          COUNT(*) as total_events
        FROM agent_audit_logs
        WHERE user_id = ${userId}
          ${fromDate ? `AND timestamp >= ${fromDate}` : ""}
          ${toDate ? `AND timestamp <= ${toDate}` : ""}
      `;

      // Get phase distribution
      const phaseResults = await database.query<{
        phase: string;
        count: number;
      }>`
        SELECT
          phase,
          COUNT(*) as count
        FROM agent_audit_logs
        WHERE user_id = ${userId}
          ${fromDate ? `AND timestamp >= ${fromDate}` : ""}
          ${toDate ? `AND timestamp <= ${toDate}` : ""}
        GROUP BY phase
      `;

      const phaseDistribution: Record<string, number> = {};
      phaseResults.forEach((row) => {
        phaseDistribution[row.phase] = Number(row.count);
      });

      return {
        totalExecutions: result ? Number(result.total_executions) : 0,
        totalEvents: result ? Number(result.total_events) : 0,
        phaseDistribution,
      };
    } catch (error) {
      console.error("Failed to get user audit stats:", error);
      return {
        totalExecutions: 0,
        totalEvents: 0,
        phaseDistribution: {},
      };
    }
  }
}

/**
 * Singleton instance
 */
export const auditLogger = new AuditLogger();
