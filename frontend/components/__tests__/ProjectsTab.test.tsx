import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProjectsTab } from "../ProjectsTab";
import type { Project } from "~backend/projects/types";

const mockProjects: Project[] = [
  {
    id: 1,
    name: "Test Project 1",
    description: "Description 1",
    status: "active",
    health_score: 95,
    last_activity: new Date("2025-10-01"),
    metrics: {
      uptime_pct: 99.9,
      avg_response_time: 120,
      error_rate: 0.1,
      requests_per_min: 1000,
    },
    created_at: new Date("2025-09-01"),
    updated_at: new Date("2025-10-01"),
  },
  {
    id: 2,
    name: "Test Project 2",
    description: "Description 2",
    status: "development",
    health_score: 75,
    last_activity: new Date("2025-09-30"),
    metrics: {
      uptime_pct: 98.5,
      avg_response_time: 200,
      error_rate: 1.5,
      requests_per_min: 500,
    },
    created_at: new Date("2025-08-01"),
    updated_at: new Date("2025-09-30"),
  },
];

describe("ProjectsTab", () => {
  it("should render all projects", () => {
    const onProjectSelect = vi.fn();
    const onProjectUpdate = vi.fn();

    render(
      <ProjectsTab
        projects={mockProjects}
        selectedProject={null}
        onProjectSelect={onProjectSelect}
        onProjectUpdate={onProjectUpdate}
      />
    );

    expect(screen.getByText("Test Project 1")).toBeInTheDocument();
    expect(screen.getByText("Test Project 2")).toBeInTheDocument();
  });

  it("should highlight selected project", () => {
    const onProjectSelect = vi.fn();
    const onProjectUpdate = vi.fn();

    const { container } = render(
      <ProjectsTab
        projects={mockProjects}
        selectedProject={mockProjects[0]}
        onProjectSelect={onProjectSelect}
        onProjectUpdate={onProjectUpdate}
      />
    );

    const selectedCard = container.querySelector('.ring-2.ring-primary');
    expect(selectedCard).toBeInTheDocument();
  });

  it("should call onProjectSelect when project is clicked", () => {
    const onProjectSelect = vi.fn();
    const onProjectUpdate = vi.fn();

    render(
      <ProjectsTab
        projects={mockProjects}
        selectedProject={null}
        onProjectSelect={onProjectSelect}
        onProjectUpdate={onProjectUpdate}
      />
    );

    fireEvent.click(screen.getByText("Test Project 1"));
    expect(onProjectSelect).toHaveBeenCalledWith(mockProjects[0]);
  });

  it("should display correct health score color", () => {
    const onProjectSelect = vi.fn();
    const onProjectUpdate = vi.fn();

    render(
      <ProjectsTab
        projects={mockProjects}
        selectedProject={null}
        onProjectSelect={onProjectSelect}
        onProjectUpdate={onProjectUpdate}
      />
    );

    const healthScore1 = screen.getByText("95%");
    expect(healthScore1).toHaveClass("text-green-500");

    const healthScore2 = screen.getByText("75%");
    expect(healthScore2).toHaveClass("text-yellow-500");
  });

  it("should display project metrics correctly", () => {
    const onProjectSelect = vi.fn();
    const onProjectUpdate = vi.fn();

    render(
      <ProjectsTab
        projects={mockProjects}
        selectedProject={null}
        onProjectSelect={onProjectSelect}
        onProjectUpdate={onProjectUpdate}
      />
    );

    expect(screen.getByText("99.9%")).toBeInTheDocument();
    expect(screen.getByText("120ms")).toBeInTheDocument();
    expect(screen.getByText("0.1%")).toBeInTheDocument();
  });
});
