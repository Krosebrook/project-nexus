import { Clock, TrendingUp, AlertCircle, ExternalLink, PlayCircle, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Project } from "~backend/projects/types";

interface DashboardProps {
  projects: Project[];
  onProjectSelect: (project: Project) => void;
}

export function Dashboard({ projects, onProjectSelect }: DashboardProps) {
  const getStatusBadge = (healthScore: number) => {
    if (healthScore >= 80) {
      return <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Healthy</Badge>;
    } else if (healthScore >= 60) {
      return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Warning</Badge>;
    } else {
      return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Critical</Badge>;
    }
  };

  const formatDeploymentTime = (lastActivity: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(lastActivity).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };

  const getMetricValue = (project: Project, key: string, defaultValue: number = 0) => {
    return project.metrics?.[key] ?? defaultValue;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-zinc-400 mt-1">Monitor all your production projects in one place</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.map((project) => {
          const apiLatency = getMetricValue(project, 'avg_response_time', 0);
          const errorRate = getMetricValue(project, 'error_rate', 0);
          const uptime = getMetricValue(project, 'uptime_pct', 0);

          return (
            <Card
              key={project.id}
              className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/5 group"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate group-hover:text-blue-400 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-sm text-zinc-500 line-clamp-2">
                      {project.description || 'No description'}
                    </p>
                  </div>
                  {getStatusBadge(project.health_score)}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500">API Latency</p>
                    <p className={`text-lg font-semibold ${
                      apiLatency > 500 ? 'text-red-400' : apiLatency > 200 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {apiLatency}ms
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500">Error Rate</p>
                    <p className={`text-lg font-semibold ${
                      errorRate > 5 ? 'text-red-400' : errorRate > 1 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {errorRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500">Uptime</p>
                    <p className={`text-lg font-semibold ${
                      uptime < 95 ? 'text-red-400' : uptime < 99 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {uptime.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-500 pt-2 border-t border-zinc-800">
                  <Clock className="w-3 h-3" />
                  <span>Deployed {formatDeploymentTime(project.last_activity)}</span>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-zinc-700 hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-400 transition-all"
                    onClick={() => onProjectSelect(project)}
                  >
                    <PlayCircle className="w-3 h-3 mr-1" />
                    Deploy
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="hover:bg-zinc-800 hover:text-blue-400"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Logs
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="hover:bg-zinc-800 hover:text-blue-400"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-400">No projects found</h3>
          <p className="text-sm text-zinc-500 mt-1">Create your first project to get started</p>
        </div>
      )}
    </div>
  );
}