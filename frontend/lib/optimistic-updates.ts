import { useState, useCallback } from "react";

export interface OptimisticUpdate<T> {
  data: T;
  isPending: boolean;
  error: Error | null;
}

export function useOptimisticMutation<T, TArgs extends any[]>(
  mutationFn: (...args: TArgs) => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
    optimisticUpdate?: (...args: TArgs) => T;
  }
) {
  const [state, setState] = useState<OptimisticUpdate<T | null>>({
    data: null,
    isPending: false,
    error: null,
  });

  const mutate = useCallback(async (...args: TArgs) => {
    setState(prev => ({
      ...prev,
      isPending: true,
      error: null,
      data: options?.optimisticUpdate ? options.optimisticUpdate(...args) : prev.data,
    }));

    try {
      const result = await mutationFn(...args);
      setState({
        data: result,
        isPending: false,
        error: null,
      });
      options?.onSuccess?.(result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown error");
      setState(prev => ({
        data: options?.optimisticUpdate ? null : prev.data,
        isPending: false,
        error: err,
      }));
      options?.onError?.(err);
      throw error;
    }
  }, [mutationFn, options]);

  return { ...state, mutate };
}

export function createOptimisticList<T extends { id: number | string }>(
  items: T[]
) {
  return {
    add: (item: T) => [...items, item],
    update: (id: T["id"], updates: Partial<T>) =>
      items.map(item => (item.id === id ? { ...item, ...updates } : item)),
    remove: (id: T["id"]) => items.filter(item => item.id !== id),
  };
}