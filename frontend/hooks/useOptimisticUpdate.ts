import { useState } from "react";

export function useOptimisticUpdate<T>(initialData: T[]) {
  const [data, setData] = useState<T[]>(initialData);
  const [optimisticData, setOptimisticData] = useState<T[]>(initialData);

  const addOptimistic = (item: T) => {
    setOptimisticData((prev) => [...prev, item]);
  };

  const removeOptimistic = (predicate: (item: T) => boolean) => {
    setOptimisticData((prev) => prev.filter((item) => !predicate(item)));
  };

  const updateOptimistic = (predicate: (item: T) => boolean, updates: Partial<T>) => {
    setOptimisticData((prev) =>
      prev.map((item) => (predicate(item) ? { ...item, ...updates } : item))
    );
  };

  const commit = (newData: T[]) => {
    setData(newData);
    setOptimisticData(newData);
  };

  const rollback = () => {
    setOptimisticData(data);
  };

  return {
    data: optimisticData,
    addOptimistic,
    removeOptimistic,
    updateOptimistic,
    commit,
    rollback,
  };
}
