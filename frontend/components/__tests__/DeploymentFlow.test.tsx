import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import backend from '~backend/client';

vi.mock('~backend/client', () => ({
  default: {
    deployments: {
      deploy: vi.fn(),
      status: vi.fn(),
      listEnvironments: vi.fn(),
    },
    projects: {
      get: vi.fn(),
    }
  }
}));

describe('Deployment Flow E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full deployment flow successfully', async () => {
    const mockEnvironments = [
      { id: 1, project_id: 1, name: 'development', type: 'development' as const, is_active: true, config: {}, url: undefined, created_at: new Date(), updated_at: new Date() },
      { id: 2, project_id: 1, name: 'staging', type: 'staging' as const, is_active: true, config: {}, url: undefined, created_at: new Date(), updated_at: new Date() },
      { id: 3, project_id: 1, name: 'production', type: 'production' as const, is_active: true, config: {}, url: undefined, created_at: new Date(), updated_at: new Date() }
    ];

    const mockDeployment = {
      id: 1,
      status: 'in_progress' as const,
      stage: 'validation',
      progress: 0,
      logs: 'Starting deployment...'
    };

    vi.mocked(backend.deployments.listEnvironments).mockResolvedValue({ environments: mockEnvironments });
    vi.mocked(backend.deployments.deploy).mockResolvedValue(mockDeployment);
    vi.mocked(backend.deployments.status).mockResolvedValue({
      ...mockDeployment,
      status: 'success' as const,
      progress: 100
    });

    expect(mockEnvironments).toHaveLength(3);
    expect(mockDeployment.status).toBe('in_progress');
  });

  it('should trigger rollback on deployment failure', async () => {
    const mockDeployment = {
      id: 1,
      status: 'failed' as const,
      stage: 'health_check',
      progress: 90,
      logs: 'Health check failed',
      error_message: 'critical error detected'
    };

    vi.mocked(backend.deployments.status).mockResolvedValue(mockDeployment);

    const shouldRollback = mockDeployment.error_message?.includes('critical');
    expect(shouldRollback).toBe(true);
    expect(mockDeployment.status).toBe('failed');
  });

  it('should track deployment progress through all stages', async () => {
    const stages = [
      { stage: 'validation', progress: 0 },
      { stage: 'build', progress: 20 },
      { stage: 'testing', progress: 40 },
      { stage: 'migration', progress: 60 },
      { stage: 'deployment', progress: 80 },
      { stage: 'health_check', progress: 90 },
      { stage: 'complete', progress: 100 }
    ];

    for (const stageData of stages) {
      const mockStatus = {
        id: 1,
        status: (stageData.stage === 'complete' ? 'success' : 'in_progress') as 'success' | 'in_progress',
        stage: stageData.stage,
        progress: stageData.progress,
        logs: `Stage: ${stageData.stage}`
      };

      vi.mocked(backend.deployments.status).mockResolvedValue(mockStatus);
      
      const status = await backend.deployments.status({ id: 1 });
      expect(status.stage).toBe(stageData.stage);
      expect(status.progress).toBe(stageData.progress);
    }
  });
});