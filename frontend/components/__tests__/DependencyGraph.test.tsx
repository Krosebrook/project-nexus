import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DependencyGraph } from '../DependencyGraph';
import backend from '~backend/client';

vi.mock('~backend/client', () => ({
  default: {
    deployments: {
      getDependencyGraph: vi.fn(),
    }
  }
}));

describe('Dependency Graph Visualization E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dependency graph with nodes and edges', async () => {
    const mockGraph = {
      nodes: [
        { id: 1, name: 'Project A' },
        { id: 2, name: 'Project B' },
        { id: 3, name: 'Project C' }
      ],
      edges: [
        { from: 1, to: 2, type: 'direct' },
        { from: 2, to: 3, type: 'direct' },
        { from: 1, to: 3, type: 'transitive' }
      ]
    };

    vi.mocked(backend.deployments.getDependencyGraph).mockResolvedValue(mockGraph);

    render(<DependencyGraph projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Project Dependencies')).toBeInTheDocument();
      expect(screen.getByText(/3 projects, 3 dependencies/)).toBeInTheDocument();
    });

    expect(mockGraph.edges).toHaveLength(3);
    expect(mockGraph.nodes).toHaveLength(3);
  });

  it('should handle empty dependency graph', async () => {
    const mockGraph = {
      nodes: [],
      edges: []
    };

    vi.mocked(backend.deployments.getDependencyGraph).mockResolvedValue(mockGraph);

    render(<DependencyGraph projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('No dependencies found')).toBeInTheDocument();
    });
  });

  it('should detect circular dependencies', async () => {
    const graphWithCycle = {
      nodes: [
        { id: 1, name: 'Project A' },
        { id: 2, name: 'Project B' },
        { id: 3, name: 'Project C' }
      ],
      edges: [
        { from: 1, to: 2, type: 'direct' },
        { from: 2, to: 3, type: 'direct' },
        { from: 3, to: 1, type: 'direct' }
      ]
    };

    vi.mocked(backend.deployments.getDependencyGraph).mockResolvedValue(graphWithCycle);

    const hasCycle = (edges: typeof graphWithCycle.edges): boolean => {
      const visited = new Set<number>();
      const stack = new Set<number>();

      const dfs = (nodeId: number): boolean => {
        if (stack.has(nodeId)) return true;
        if (visited.has(nodeId)) return false;

        visited.add(nodeId);
        stack.add(nodeId);

        const outgoing = edges.filter(e => e.from === nodeId);
        for (const edge of outgoing) {
          if (dfs(edge.to)) return true;
        }

        stack.delete(nodeId);
        return false;
      };

      for (const node of graphWithCycle.nodes) {
        if (dfs(node.id)) return true;
      }

      return false;
    };

    expect(hasCycle(graphWithCycle.edges)).toBe(true);
  });

  it('should differentiate between dependency types', async () => {
    const mockGraph = {
      nodes: [
        { id: 1, name: 'Main Project' },
        { id: 2, name: 'Production Lib' },
        { id: 3, name: 'Dev Tool' }
      ],
      edges: [
        { from: 1, to: 2, type: 'direct' },
        { from: 1, to: 3, type: 'dev' }
      ]
    };

    vi.mocked(backend.deployments.getDependencyGraph).mockResolvedValue(mockGraph);

    render(<DependencyGraph projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Direct')).toBeInTheDocument();
      expect(screen.getByText('Dev')).toBeInTheDocument();
    });

    const directEdges = mockGraph.edges.filter(e => e.type === 'direct');
    const devEdges = mockGraph.edges.filter(e => e.type === 'dev');
    
    expect(directEdges).toHaveLength(1);
    expect(devEdges).toHaveLength(1);
  });
});