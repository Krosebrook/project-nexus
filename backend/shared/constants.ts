export const DEPLOYMENT_STAGES = [
  { name: 'validation', progress: 10 },
  { name: 'build', progress: 25 },
  { name: 'testing', progress: 40 },
  { name: 'migration', progress: 60 },
  { name: 'deployment', progress: 75 },
  { name: 'health_check', progress: 90 },
  { name: 'complete', progress: 100 },
] as const;

export const SYNC_CONFIG = {
  BATCH_SIZE: 50,
  POLL_INTERVAL_MS: 30000,
  MAX_RETRY_ATTEMPTS: 10,
} as const;

export const STORAGE_CONFIG = {
  RETENTION_DAYS: 90,
  MAX_DEPLOYMENTS: 200,
  QUOTA_WARNING_THRESHOLD: 0.8,
} as const;

export const RATE_LIMITS = {
  LLM_REQUESTS_PER_MINUTE: 10,
} as const;
