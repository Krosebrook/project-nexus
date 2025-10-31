import { api } from 'encore.dev/api';
import { llmRouter } from './router';
import { HealthResponse } from './types';

export const health = api(
  { expose: true, method: 'GET', path: '/llm/health' },
  async (): Promise<HealthResponse> => {
    const providers = await llmRouter.healthCheck();
    return { providers };
  }
);
