import log from "encore.dev/log";

export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

const queryMetrics: QueryMetrics[] = [];
const SLOW_QUERY_THRESHOLD_MS = 1000;
const MAX_METRICS_STORAGE = 1000;

export async function monitorQuery<T>(
  queryName: string,
  query: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  let success = true;
  let error: string | undefined;

  try {
    const result = await query();
    return result;
  } catch (err) {
    success = false;
    error = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    const duration = Date.now() - startTime;
    
    const metric: QueryMetrics = {
      query: queryName,
      duration,
      timestamp: new Date(),
      success,
      error,
    };

    queryMetrics.push(metric);
    if (queryMetrics.length > MAX_METRICS_STORAGE) {
      queryMetrics.shift();
    }

    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      log.warn("Slow query detected", {
        query: queryName,
        duration: `${duration}ms`,
        threshold: `${SLOW_QUERY_THRESHOLD_MS}ms`,
      });
    }

    if (!success) {
      log.error("Query failed", {
        query: queryName,
        duration: `${duration}ms`,
        error,
      });
    }
  }
}

export function getQueryMetrics(): QueryMetrics[] {
  return [...queryMetrics];
}

export function getSlowQueries(thresholdMs: number = SLOW_QUERY_THRESHOLD_MS): QueryMetrics[] {
  return queryMetrics.filter(m => m.duration > thresholdMs);
}

export function getAverageQueryTime(queryName?: string): number {
  const relevantMetrics = queryName 
    ? queryMetrics.filter(m => m.query === queryName)
    : queryMetrics;

  if (relevantMetrics.length === 0) return 0;

  const totalDuration = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
  return totalDuration / relevantMetrics.length;
}
