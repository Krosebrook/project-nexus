import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MetricCard } from "@/components/MetricCard";
import { Activity, TrendingUp, Clock, AlertCircle } from "lucide-react";
import type { Project } from "~backend/projects/types";
import { formatDistanceToNow } from "date-fns";

interface ProjectsTabProps {
  projects: Project[];
  selectedProject: Project | null;
  onProjectSelect: (project: Project) => void;
  onProjectUpdate: () => void;
}

export function ProjectsTab({ projects, selectedProject, onProjectSelect }: ProjectsTabProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500";
      case "development": return "bg-blue-500";
      case "maintenance": return "bg-yellow-500";
      case "archived": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 70) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card
            key={project.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedProject?.id === project.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => onProjectSelect(project)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {project.description}
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(project.status)} variant="default">
                  {project.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Health Score</span>
                  <span className={`font-semibold ${getHealthColor(project.health_score)}`}>
                    {project.health_score}%
                  </span>
                </div>
                <Progress value={project.health_score} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>Uptime</span>
                  </div>
                  <p className="font-semibold">{project.metrics.uptime_pct}%</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Activity className="h-3.5 w-3.5" />
                    <span>Response</span>
                  </div>
                  <p className="font-semibold">{project.metrics.avg_response_time}ms</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Errors</span>
                  </div>
                  <p className="font-semibold">{project.metrics.error_rate}%</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Updated</span>
                  </div>
                  <p className="font-semibold text-xs">
                    {formatDistanceToNow(new Date(project.last_activity), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
