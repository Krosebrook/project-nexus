import { api } from "encore.dev/api";
import type { LogsRequest, LogEntry } from "./types";

const LOG_LEVELS = ['info', 'warning', 'error'];

function generateMockLogs(count: number, level?: string, timeRange?: string): LogEntry[] {
  const logs: LogEntry[] = [];
  const now = new Date();
  const messages = [
    'Application started successfully',
    'Database connection established',
    'API endpoint /api/users called',
    'Cache miss for key: user_123',
    'Processing background job: send_email',
    'Rate limit exceeded for IP: 192.168.1.1',
    'Failed to connect to external service',
    'Memory usage: 245MB / 512MB',
    'Request completed in 45ms',
    'Deprecated API endpoint accessed'
  ];

  for (let i = 0; i < count; i++) {
    const logLevel = level || LOG_LEVELS[Math.floor(Math.random() * LOG_LEVELS.length)];
    const timestamp = new Date(now.getTime() - i * 60000);
    const message = messages[Math.floor(Math.random() * messages.length)];

    logs.push({
      timestamp,
      level: logLevel,
      message: `[${logLevel.toUpperCase()}] ${message}`
    });
  }

  return logs;
}

export const logs = api(
  { method: "GET", path: "/deployments/logs/:project_id", expose: true },
  async (req: LogsRequest): Promise<{ logs: LogEntry[] }> => {
    const logEntries = generateMockLogs(200, req.level, req.time_range);
    return { logs: logEntries };
  }
);