import { api } from "encore.dev/api";
import db from "../db";
import type { ErrorStats, ErrorLog } from "./types";

export const getStats = api(
  { method: "GET", path: "/errors/stats", expose: true },
  async (): Promise<ErrorStats> => {
    const totalResult = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM error_logs
    `;

    const byType = await db.queryAll<{ error_type: string; count: number }>`
      SELECT error_type, COUNT(*) as count
      FROM error_logs
      GROUP BY error_type
      ORDER BY count DESC
      LIMIT 10
    `;

    const bySeverity = await db.queryAll<{ severity: string; count: number }>`
      SELECT severity, COUNT(*) as count
      FROM error_logs
      GROUP BY severity
    `;

    const recentErrors = await db.queryAll`
      SELECT * FROM error_logs
      ORDER BY timestamp DESC
      LIMIT 20
    `;

    const errorsByType: Record<string, number> = {};
    byType.forEach(item => {
      errorsByType[item.error_type] = Number(item.count);
    });

    const errorsBySeverity: Record<string, number> = {};
    bySeverity.forEach(item => {
      errorsBySeverity[item.severity] = Number(item.count);
    });

    return {
      total_errors: Number(totalResult?.count || 0),
      errors_by_type: errorsByType,
      errors_by_severity: errorsBySeverity,
      recent_errors: recentErrors as ErrorLog[]
    };
  }
);