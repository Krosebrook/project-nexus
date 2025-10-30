import db from "../../db";

const MAX_ATTEMPTS = 60;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const JITTER_FACTOR = 0.3;

function jitteredBackoff(attempt: number): number {
  const exponentialDelay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
  const jitter = exponentialDelay * JITTER_FACTOR * Math.random();
  return Math.floor(exponentialDelay + jitter);
}

export async function waitForPostgres(timeoutMs: number = 300000): Promise<boolean> {
  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < timeoutMs) {
    try {
      await db.queryRow`SELECT 1 as ready`;
      console.log(`Postgres ready after ${attempt + 1} attempts (${Date.now() - startTime}ms)`);
      return true;
    } catch (error) {
      attempt++;
      if (attempt >= MAX_ATTEMPTS) {
        throw new Error(`Postgres not ready after ${MAX_ATTEMPTS} attempts`);
      }

      const delay = jitteredBackoff(attempt);
      const remaining = timeoutMs - (Date.now() - startTime);
      
      if (remaining <= delay) {
        throw new Error(`Postgres readiness timeout after ${Date.now() - startTime}ms`);
      }

      console.log(`Postgres not ready, retrying in ${delay}ms (attempt ${attempt}/${MAX_ATTEMPTS})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(`Postgres readiness timeout after ${timeoutMs}ms`);
}
