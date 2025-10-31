import { useState, useCallback } from 'react';
import { db } from '../db/schema';

interface OptimisticMutationOptions<T, R> {
  mutationFn: (data: T) => Promise<R>;
  onSuccess?: (result: R) => void;
  onError?: (error: Error) => void;
  rollback?: () => Promise<void>;
}

export function useOptimisticMutation<T, R>(options: OptimisticMutationOptions<T, R>) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (data: T, optimisticData?: Partial<R>) => {
      setIsLoading(true);
      setError(null);

      let rollbackSnapshot: any = null;
      
      if (optimisticData) {
        try {
          rollbackSnapshot = await createSnapshot();

          await applyOptimisticUpdate(optimisticData);
        } catch (err) {
          console.error('[OptimisticMutation] Failed to apply optimistic update:', err);
        }
      }

      try {
        const result = await options.mutationFn(data);

        options.onSuccess?.(result);

        return result;
      } catch (err) {
        setError(err as Error);

        if (rollbackSnapshot) {
          try {
            await restoreSnapshot(rollbackSnapshot);
            await options.rollback?.();
          } catch (rollbackErr) {
            console.error('[OptimisticMutation] Rollback failed:', rollbackErr);
          }
        }

        options.onError?.(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  return { mutate, isLoading, error };
}

async function createSnapshot(): Promise<any> {
  return {
    deployments: await db.deployments.toArray(),
    projects: await db.projects.toArray(),
    artifacts: await db.artifacts.toArray(),
    queue_items: await db.queue_items.toArray(),
  };
}

async function applyOptimisticUpdate(data: any) {
  if (data.id && data.status) {
    await db.deployments.update(data.id, { status: data.status });
  }
}

async function restoreSnapshot(snapshot: any) {
  await db.transaction('rw', [db.deployments, db.projects, db.artifacts, db.queue_items], async () => {
    await db.deployments.clear();
    await db.deployments.bulkPut(snapshot.deployments);

    await db.projects.clear();
    await db.projects.bulkPut(snapshot.projects);

    await db.artifacts.clear();
    await db.artifacts.bulkPut(snapshot.artifacts);

    await db.queue_items.clear();
    await db.queue_items.bulkPut(snapshot.queue_items);
  });
}
