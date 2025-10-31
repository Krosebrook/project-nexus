import { db } from './schema';

export async function optimizeDatabase() {
  console.log('[Performance] Optimizing IndexedDB...');

  await db.version(3).stores({
    deployments: 'id, [status+created_at], project_id, created_at, synced',
    sync_events: 'id, [synced+timestamp], timestamp, entity, synced',
    queue_items: 'id, [status+scheduled_at], deployment_id, scheduled_at, status, synced',
  });

  const BATCH_SIZE = 50;

  async function batchInsert<T>(table: any, items: T[]) {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await table.bulkAdd(batch);
    }
  }

  setInterval(async () => {
    const pruneStartTime = performance.now();
    await db.pruneOldData(90);
    const pruneEndTime = performance.now();
    console.log(`[Performance] Pruned old data in ${pruneEndTime - pruneStartTime}ms`);
  }, 24 * 60 * 60 * 1000);

  return { batchInsert };
}

export async function measureQueryPerformance<T>(
  name: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  const result = await queryFn();
  const endTime = performance.now();
  
  const duration = endTime - startTime;
  console.log(`[Performance] ${name} took ${duration.toFixed(2)}ms`);
  
  if (duration > 100) {
    console.warn(`[Performance] Slow query detected: ${name} (${duration.toFixed(2)}ms)`);
  }
  
  return result;
}

export class QueryCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>();
  private maxAge: number;

  constructor(maxAgeMs: number = 60000) {
    this.maxAge = maxAgeMs;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: K, value: V): void {
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key);
      }
    }
  }
}
