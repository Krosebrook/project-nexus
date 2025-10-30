import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { Project } from "~backend/projects/types";
import { formatRelativeTime, getHealthStatus, type MetricDataPoint } from "@/lib/metrics-utils";
import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/utils";

interface EnhancedProjectCardProps {
  project: Project;
  latencyData: MetricDataPoint[];
  errorRateData: MetricDataPoint[];
  onSelect: (project: Project) => void;
  isSelected: boolean;
}

export function EnhancedProjectCard({
  project,
  latencyData,
  errorRateData,
  onSelect,
  isSelected
}: EnhancedProjectCardProps) {
  const latency = project.metrics.avg_response_time || 0;
  const errorRate = project.metrics.error_rate || 0;
  const uptime = project.metrics.uptime_pct || 0;
  
  const animatedLatency = useCountUp(latency, 300);
  const animatedErrorRate = useCountUp(errorRate, 300);
  const animatedUptime = useCountUp(uptime, 300);
  
  const healthStatus = getHealthStatus(errorRate, uptime, latency);
  
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500";
      case "development": return "bg-blue-500";
      case "maintenance": return "bg-yellow-500";
      case "archived": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };
  
  const getHealthBadgeColor = (status: "healthy" | "warning" | "critical") => {
    switch (status) {
      case "healthy": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "warning": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "critical": return "bg-red-500/10 text-red-500 border-red-500/20";
    }
  };
  
  const latencyChartData = latencyData.slice(-24).map(d => ({ value: d.value }));
  const errorChartData = errorRateData.slice(-24).map(d => ({ value: d.value }));
  
  return (
    <Card
      data-testid={`project-card-${project.id}`}
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={() => onSelect(project)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{project.name}</CardTitle>
            <CardDescription className="text-sm line-clamp-2">
              {project.description}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            <Badge className={getStatusBadgeColor(project.status)} variant="default">
              {project.status}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                getHealthBadgeColor(healthStatus),
                healthStatus === "critical" && "animate-pulse"
              )}
            >
              {healthStatus}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Latency</div>
            <div className="font-semibold text-sm">
              {animatedLatency.toFixed(0)}ms
            </div>
            <div className="h-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyChartData}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Error Rate</div>
            <div className={cn(
              "font-semibold text-sm",
              errorRate > 1 && "text-red-500"
            )}>
              {animatedErrorRate.toFixed(2)}%
            </div>
            <div className="h-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={errorChartData}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={errorRate > 1 ? "hsl(0 72% 51%)" : "hsl(var(--primary))"}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Uptime</div>
            <div className="font-semibold text-sm">
              {animatedUptime.toFixed(1)}%
            </div>
            <div className="flex items-center justify-center h-8">
              <div className="relative w-12 h-12">
                <svg className="transform -rotate-90 w-12 h-12">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="hsl(var(--primary))"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - uptime / 100)}`}
                    className="transition-all duration-300"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Updated {formatRelativeTime(new Date(project.last_activity))}</span>
          <span className="text-right">Health: {project.health_score}%</span>
        </div>
      </CardContent>
    </Card>
  );
}