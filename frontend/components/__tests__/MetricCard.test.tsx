import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCard } from "../MetricCard";
import { Activity } from "lucide-react";

describe("MetricCard", () => {
  it("should render title and value", () => {
    render(
      <MetricCard
        title="Response Time"
        value="120ms"
        icon={Activity}
      />
    );

    expect(screen.getByText("Response Time")).toBeInTheDocument();
    expect(screen.getByText("120ms")).toBeInTheDocument();
  });

  it("should render with trend indicator", () => {
    render(
      <MetricCard
        title="Uptime"
        value="99.9%"
        icon={Activity}
        trend={{ value: 2.5, label: "from last week" }}
      />
    );

    expect(screen.getByText("2.5%")).toBeInTheDocument();
  });

  it("should render description when provided", () => {
    render(
      <MetricCard
        title="Error Rate"
        value="0.1%"
        icon={Activity}
        description="Last 24 hours"
      />
    );

    expect(screen.getByText("Last 24 hours")).toBeInTheDocument();
  });

  it("should apply positive trend color", () => {
    const { container } = render(
      <MetricCard
        title="Test"
        value="100"
        icon={Activity}
        trend={{ value: 5, label: "from last week" }}
      />
    );

    const trendElement = container.querySelector('.text-green-500');
    expect(trendElement).toBeInTheDocument();
  });

  it("should apply negative trend color", () => {
    const { container } = render(
      <MetricCard
        title="Test"
        value="100"
        icon={Activity}
        trend={{ value: -5, label: "from last week" }}
      />
    );

    const trendElement = container.querySelector('.text-red-500');
    expect(trendElement).toBeInTheDocument();
  });
});
