import db from "../../db";

const MAX_ATTEMPTS = 60;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const JITTER_FACTOR = 0.3;
const DEFAULT_TIMEOUT_MS = 300000;

export interface ReadinessResult {
  ready: boolean;
  attempts: number;
  elapsedMs: number;
  error?: string;
}

function jitteredBackoff(attempt: number): number {
  const exponentialDelay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
  const jitter = exponentialDelay * JITTER_FACTOR * Math.random();
  return Math.floor(exponentialDelay + jitter);
}

function logJSON(level: string, message: string, metadata: Record<string, unknown> = {}): void {
  const redacted = { ...metadata };
  if (redacted.connectionString) {
    redacted.connectionString = "[REDACTED]";
  }
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...redacted
  }));
}

export async function waitForPostgres(timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<ReadinessResult> {
  const startTime = Date.now();
  let attempt = 0;

  logJSON("info", "Starting Postgres readiness probe", { timeoutMs, maxAttempts: MAX_ATTEMPTS });

  while (Date.now() - startTime < timeoutMs) {
    try {
      await db.queryRow`SELECT 1 as ready`;
      const elapsedMs = Date.now() - startTime;
      
      logJSON("info", "Postgres ready", { attempts: attempt + 1, elapsedMs });
      
      return {
        ready: true,
        attempts: attempt + 1,
        elapsedMs
      };
    } catch (error) {
      attempt++;
      const elapsedMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (attempt >= MAX_ATTEMPTS) {
        logJSON("error", "Postgres not ready after max attempts", {
          attempts: MAX_ATTEMPTS,
          elapsedMs,
          error: errorMessage
        });
        
        return {
          ready: false,
          attempts,
          elapsedMs,
          error: `Postgres not ready after ${MAX_ATTEMPTS} attempts. Last error: ${errorMessage}`
        };
      }

      const delay = jitteredBackoff(attempt);
      const remaining = timeoutMs - elapsedMs;
      
      if (remaining <= delay) {
        logJSON("error", "Postgres readiness timeout", {
          attempts: attempt,
          elapsedMs,
          timeoutMs,
          error: errorMessage
        });
        
        return {
          ready: false,
          attempts,
          elapsedMs,
          error: `Postgres readiness timeout after ${elapsedMs}ms. Last error: ${errorMessage}`
        };
      }

      logJSON("warn", "Postgres not ready, retrying with backoff", {
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        delayMs: delay,
        elapsedMs,
        error: errorMessage
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  const elapsedMs = Date.now() - startTime;
  logJSON("error", "Postgres readiness timeout exceeded", {
    attempts: attempt,
    elapsedMs,
    timeoutMs
  });

  return {
    ready: false,
    attempts,
    elapsedMs,
    error: `Postgres readiness timeout after ${timeoutMs}ms`
  };
}

if (require.main === module) {
  (async () => {
    const result = await waitForPostgres();
    if (!result.ready) {
      logJSON("error", "Database readiness check failed", result);
      process.exit(1);
    }
    logJSON("info", "Database is ready", result);
    process.exit(0);
  })();
}
