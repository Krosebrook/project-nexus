import { useEffect, useState, useCallback } from "react";
import { subscribeToMetric } from "../lib/websocket-metrics";

export function useMetricSubscription<T = any>(
  metric: string,
  initialValue: T
): [T, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  const [isConnected, setIsConnected] = useState(false);

  const handleUpdate = useCallback((data: T) => {
    setValue(data);
    setIsConnected(true);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToMetric(metric, handleUpdate);

    return () => {
      unsubscribe();
      setIsConnected(false);
    };
  }, [metric, handleUpdate]);

  return [value, isConnected];
}

export function useMultipleMetrics(
  metrics: string[]
): [Record<string, any>, boolean] {
  const [values, setValues] = useState<Record<string, any>>({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    metrics.forEach(metric => {
      const unsubscribe = subscribeToMetric(metric, (data) => {
        setValues(prev => ({ ...prev, [metric]: data }));
        setIsConnected(true);
      });
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
      setIsConnected(false);
    };
  }, [metrics]);

  return [values, isConnected];
}