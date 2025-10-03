export interface MetricDataPoint {
  timestamp: number;
  value: number;
}

export interface HistoricalMetrics {
  latency: MetricDataPoint[];
  errorRate: MetricDataPoint[];
  uptime: MetricDataPoint[];
}

export function generateHistoricalData(hours: number = 24): HistoricalMetrics {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  
  const latency: MetricDataPoint[] = [];
  const errorRate: MetricDataPoint[] = [];
  const uptime: MetricDataPoint[] = [];
  
  for (let i = hours; i >= 0; i--) {
    const timestamp = now - (i * hourMs);
    latency.push({
      timestamp,
      value: 150 + Math.random() * 100
    });
    errorRate.push({
      timestamp,
      value: Math.random() * 2
    });
    uptime.push({
      timestamp,
      value: 98 + Math.random() * 2
    });
  }
  
  return { latency, errorRate, uptime };
}

export function simulateMetricUpdate(
  currentValue: number,
  baseValue: number,
  variance: number
): number {
  const change = (Math.random() - 0.5) * variance * 2;
  const newValue = currentValue + change;
  return Math.max(0, Math.min(baseValue * 2, newValue));
}

export function getHealthStatus(
  errorRate: number,
  uptime: number,
  latency: number
): "healthy" | "warning" | "critical" {
  if (errorRate > 5 || uptime < 95 || latency > 500) {
    return "critical";
  }
  if (errorRate > 1 || uptime < 98 || latency > 300) {
    return "warning";
  }
  return "healthy";
}

export function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatLastUpdated(seconds: number): string {
  if (seconds < 1) return "just now";
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}