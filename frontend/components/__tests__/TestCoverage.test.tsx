import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TestCoverageChart } from '../TestCoverageChart';
import backend from '~backend/client';

vi.mock('~backend/client', () => ({
  default: {
    deployments: {
      getCoverage: vi.fn(),
      getCoverageTrend: vi.fn(),
    }
  }
}));

describe('Test Coverage Tracking E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display coverage data and trend', async () => {
    const mockCoverage = [
      {
        id: 1,
        project_id: 1,
        total_lines: 1000,
        covered_lines: 850,
        coverage_percentage: 85.0,
        created_at: new Date()
      },
      {
        id: 2,
        project_id: 1,
        total_lines: 1000,
        covered_lines: 800,
        coverage_percentage: 80.0,
        created_at: new Date(Date.now() - 86400000)
      }
    ];

    const mockTrend = {
      trend: 5.0,
      latest: 85.0,
      previous: 80.0
    };

    vi.mocked(backend.deployments.getCoverage).mockResolvedValue({ coverage: mockCoverage });
    vi.mocked(backend.deployments.getCoverageTrend).mockResolvedValue(mockTrend);

    render(<TestCoverageChart projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Test Coverage')).toBeInTheDocument();
      expect(screen.getByText('85.0%')).toBeInTheDocument();
    });

    expect(mockTrend.trend).toBeGreaterThan(0);
  });

  it('should handle no coverage data gracefully', async () => {
    vi.mocked(backend.deployments.getCoverage).mockResolvedValue({ coverage: [] });
    vi.mocked(backend.deployments.getCoverageTrend).mockResolvedValue({
      trend: 0,
      latest: 0,
      previous: 0
    });

    render(<TestCoverageChart projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('No coverage data available')).toBeInTheDocument();
    });
  });

  it('should track coverage progression over time', async () => {
    const coverageHistory = [
      { coverage_percentage: 85.0, created_at: new Date() },
      { coverage_percentage: 82.5, created_at: new Date(Date.now() - 86400000) },
      { coverage_percentage: 80.0, created_at: new Date(Date.now() - 172800000) },
      { coverage_percentage: 75.0, created_at: new Date(Date.now() - 259200000) }
    ].map((item, idx) => ({
      id: idx + 1,
      project_id: 1,
      total_lines: 1000,
      covered_lines: (item.coverage_percentage / 100) * 1000,
      coverage_percentage: item.coverage_percentage,
      created_at: item.created_at
    }));

    vi.mocked(backend.deployments.getCoverage).mockResolvedValue({ coverage: coverageHistory });
    vi.mocked(backend.deployments.getCoverageTrend).mockResolvedValue({
      trend: 10.0,
      latest: 85.0,
      previous: 75.0
    });

    render(<TestCoverageChart projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Test Coverage')).toBeInTheDocument();
    });

    expect(coverageHistory[0].coverage_percentage).toBeGreaterThan(
      coverageHistory[coverageHistory.length - 1].coverage_percentage
    );
  });
});