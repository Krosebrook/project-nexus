import { useEffect, useState } from "react";
import backend from "~backend/client";
import type { TestCoverage } from "~backend/deployments/types";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TestCoverageChartProps {
  projectId: number;
}

export function TestCoverageChart({ projectId }: TestCoverageChartProps) {
  const [coverage, setCoverage] = useState<TestCoverage[]>([]);
  const [trend, setTrend] = useState<{ trend: number; latest: number; previous: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCoverage();
  }, [projectId]);

  const loadCoverage = async () => {
    try {
      const [coverageRes, trendData] = await Promise.all([
        backend.deployments.getCoverage({ projectId, limit: 30 }),
        backend.deployments.getCoverageTrend({ projectId })
      ]);
      
      setCoverage(coverageRes.coverage);
      setTrend(trendData);
    } catch (error) {
      console.error("Failed to load coverage:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          Loading coverage data...
        </div>
      </Card>
    );
  }

  if (coverage.length === 0) {
    return (
      <Card className="p-6">
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No coverage data available
        </div>
      </Card>
    );
  }

  const maxCoverage = Math.max(...coverage.map(c => c.coverage_percentage));
  const minCoverage = Math.min(...coverage.map(c => c.coverage_percentage));

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Test Coverage</h3>
          {trend && (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {trend.latest.toFixed(1)}%
              </span>
              {trend.trend > 0 && (
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">+{trend.trend.toFixed(1)}%</span>
                </div>
              )}
              {trend.trend < 0 && (
                <div className="flex items-center gap-1 text-red-600">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-sm">{trend.trend.toFixed(1)}%</span>
                </div>
              )}
              {trend.trend === 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Minus className="w-4 h-4" />
                  <span className="text-sm">No change</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative h-48">
          <svg className="w-full h-full">
            <defs>
              <linearGradient id="coverageGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity="0" />
              </linearGradient>
            </defs>
            
            {coverage.length > 1 && (
              <>
                <polyline
                  fill="url(#coverageGradient)"
                  stroke="none"
                  points={coverage
                    .map((c, i) => {
                      const x = (i / (coverage.length - 1)) * 100;
                      const y = 100 - ((c.coverage_percentage - minCoverage) / (maxCoverage - minCoverage || 1)) * 90;
                      return `${x}%,${y}%`;
                    })
                    .join(" ") + ` 100%,100% 0%,100%`}
                />
                
                <polyline
                  fill="none"
                  stroke="rgb(34, 197, 94)"
                  strokeWidth="2"
                  points={coverage
                    .map((c, i) => {
                      const x = (i / (coverage.length - 1)) * 100;
                      const y = 100 - ((c.coverage_percentage - minCoverage) / (maxCoverage - minCoverage || 1)) * 90;
                      return `${x}%,${y}%`;
                    })
                    .join(" ")}
                />
              </>
            )}
          </svg>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Latest</div>
            <div className="font-semibold">{coverage[0].coverage_percentage.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Covered Lines</div>
            <div className="font-semibold">{coverage[0].covered_lines.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Total Lines</div>
            <div className="font-semibold">{coverage[0].total_lines.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}