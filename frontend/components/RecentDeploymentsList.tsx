import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, RotateCcw, Play } from "lucide-react";
import { formatDuration, getDurationColor, getStatusColor } from "@/lib/deployment-data";
import type { Deployment } from "@/lib/deployment-data";

interface RecentDeploymentsListProps {
  deployments: Deployment[];
  onViewLogs: (deployment: Deployment) => void;
  onViewDetails: (deployment: Deployment) => void;
  onRollback: (deployment: Deployment) => void;
  onRerun: (deployment: Deployment) => void;
}

export function RecentDeploymentsList({
  deployments,
  onViewLogs,
  onViewDetails,
  onRollback,
  onRerun
}: RecentDeploymentsListProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      success: "default",
      failed: "destructive",
      in_progress: "secondary",
      rolled_back: "outline",
      queued: "outline"
    };
    
    const colors = {
      success: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
      failed: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
      in_progress: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
      rolled_back: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
      queued: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20"
    };

    return (
      <Badge variant={variants[status] || "default"} className={colors[status as keyof typeof colors]}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = Date.now();
    const diff = now - timestamp.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    const mins = Math.floor(diff / (1000 * 60));
    return `${mins}m ago`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Deployments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Time</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Project</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Version</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Environment</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Duration</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deployments.slice(0, 20).map((deployment) => (
                <tr 
                  key={deployment.id} 
                  className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onViewDetails(deployment)}
                >
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {formatTimeAgo(deployment.timestamp)}
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-foreground">
                    {deployment.projectName}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground font-mono">
                    {deployment.version}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <Badge variant="outline" className="capitalize">
                      {deployment.environment}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {getStatusBadge(deployment.status)}
                  </td>
                  <td className={`py-3 px-4 text-sm font-medium ${getDurationColor(deployment.duration)}`}>
                    {formatDuration(deployment.duration)}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewLogs(deployment)}
                        className="h-8"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Logs
                      </Button>
                      {deployment.status === "failed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRollback(deployment)}
                          className="h-8"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Rollback
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRerun(deployment)}
                        className="h-8"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Rerun
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}