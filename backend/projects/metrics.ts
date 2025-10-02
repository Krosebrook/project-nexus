import { api } from "encore.dev/api";
import { StreamOut } from "encore.dev/api";

export interface MetricsHandshake {
  project_id: number;
  interval_ms?: number;
}

export interface MetricsUpdate {
  timestamp: Date;
  health_score: number;
  metrics: Record<string, any>;
}

export const metricsStream = api.streamOut<MetricsHandshake, MetricsUpdate>(
  { path: "/projects/:project_id/metrics/stream", expose: true },
  async (handshake, stream) => {
    const interval = handshake.interval_ms || 5000;
    let active = true;
    
    const timer = setInterval(async () => {
      if (!active) {
        clearInterval(timer);
        return;
      }

      try {
        const metrics = {
          timestamp: new Date(),
          health_score: Math.floor(Math.random() * 100),
          metrics: {
            cpu_usage: Math.random() * 100,
            memory_usage: Math.random() * 100,
            response_time: Math.random() * 1000,
            error_rate: Math.random() * 10,
          }
        };
        
        await stream.send(metrics);
      } catch (err) {
        active = false;
        clearInterval(timer);
      }
    }, interval);
  }
);
