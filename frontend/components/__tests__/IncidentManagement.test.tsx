import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { IncidentManagement } from '../IncidentManagement';
import backend from '~backend/client';

vi.mock('~backend/client', () => ({
  default: {
    deployments: {
      listIncidents: vi.fn(),
      getIncidentStats: vi.fn(),
      updateIncident: vi.fn(),
      createIncident: vi.fn(),
    }
  }
}));

describe('Incident Management E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display incident list with correct stats', async () => {
    const mockIncidents = [
      {
        id: 1,
        project_id: 1,
        severity: 'critical' as const,
        title: 'Database connection failure',
        status: 'open' as const,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        project_id: 1,
        severity: 'medium' as const,
        title: 'Slow API response',
        status: 'investigating' as const,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    const mockStats = {
      open: 1,
      investigating: 1,
      resolved: 0,
      closed: 0
    };

    vi.mocked(backend.deployments.listIncidents).mockResolvedValue({ incidents: mockIncidents });
    vi.mocked(backend.deployments.getIncidentStats).mockResolvedValue(mockStats);

    render(<IncidentManagement projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Database connection failure')).toBeInTheDocument();
      expect(screen.getByText('Slow API response')).toBeInTheDocument();
    });
  });

  it('should update incident status through lifecycle', async () => {
    const incident = {
      id: 1,
      project_id: 1,
      severity: 'high' as const,
      title: 'Test Incident',
      status: 'open' as const,
      created_at: new Date(),
      updated_at: new Date()
    };

    vi.mocked(backend.deployments.listIncidents).mockResolvedValue({ incidents: [incident] });
    vi.mocked(backend.deployments.getIncidentStats).mockResolvedValue({
      open: 1,
      investigating: 0,
      resolved: 0,
      closed: 0
    });

    render(<IncidentManagement projectId={1} />);

    await waitFor(() => {
      const investigateBtn = screen.getByText('Investigate');
      expect(investigateBtn).toBeInTheDocument();
    });

    const investigateBtn = screen.getByText('Investigate');
    fireEvent.click(investigateBtn);

    await waitFor(() => {
      expect(backend.deployments.updateIncident).toHaveBeenCalledWith({
        id: 1,
        status: 'investigating'
      });
    });
  });

  it('should filter incidents by status', async () => {
    const allIncidents = [
      {
        id: 1,
        project_id: 1,
        severity: 'low' as const,
        title: 'Open Incident',
        status: 'open' as const,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        project_id: 1,
        severity: 'medium' as const,
        title: 'Resolved Incident',
        status: 'resolved' as const,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    vi.mocked(backend.deployments.listIncidents).mockResolvedValue({ incidents: allIncidents });
    vi.mocked(backend.deployments.getIncidentStats).mockResolvedValue({
      open: 1,
      investigating: 0,
      resolved: 1,
      closed: 0
    });

    const { rerender } = render(<IncidentManagement projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Open Incident')).toBeInTheDocument();
    });

    expect(backend.deployments.listIncidents).toHaveBeenCalledWith({
      projectId: 1,
      status: undefined
    });
  });
});