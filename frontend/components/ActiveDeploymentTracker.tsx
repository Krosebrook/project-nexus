import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileText, AlertCircle } from "lucide-react";
import type { Deployment, DeploymentStageInfo, StageStatus } from "@/lib/deployment-data";

interface ActiveDeploymentTrackerProps {
  deployments: Deployment[];
  onViewLogs: (deployment: Deployment, stageName?: string) => void;
}

export function ActiveDeploymentTracker({ deployments, onViewLogs }: ActiveDeploymentTrackerProps) {
  const [elapsedTimes, setElapsedTimes] = useState<Record<string, number>>({});
  
  const activeDeployments = deployments.filter(d => d.status === "in_progress");

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTimes(prev => {
        const newTimes = { ...prev };
        activeDeployments.forEach(deployment => {
          const now = Date.now();
          const elapsed = Math.floor((now - deployment.timestamp.getTime()) / 1000);
          newTimes[deployment.id] = elapsed;
        });
        return newTimes;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeDeployments.length]);

  const getStageProgress = (stages: DeploymentStageInfo[]) => {
    const total = stages.length;
    const completed = stages.filter(s => s.status === "complete").length;
    return Math.round((completed / total) * 100);
  };

  const getStageStatusIcon = (status: StageStatus) => {
    switch (status) {
      case "complete": return "✓";
      case "running": return "⟳";
      case "failed": return "✗";
      case "pending": return "○";
      default: return "○";
    }
  };

  const getStageStatusColor = (status: StageStatus) => {
    switch (status) {
      case "complete": return "text-green-500";
      case "running": return "text-yellow-500 animate-pulse";
      case "failed": return "text-red-500";
      case "pending": return "text-gray-500";
      default: return "text-gray-500";
    }
  };

  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (activeDeployments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {activeDeployments.map(deployment => {
        const elapsed = elapsedTimes[deployment.id] || 0;
        const progress = getStageProgress(deployment.stages);

        return (
          <Card key={deployment.id} className="border-yellow-500/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {deployment.projectName} {deployment.version}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Deployment in progress • {formatElapsedTime(elapsed)} elapsed
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-yellow-500">{progress}%</div>
                  <div className="text-xs text-muted-foreground">Complete</div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={progress} className="mb-6" />
              
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {deployment.stages.map((stage, index) => {
                  const isRunning = stage.status === "running";
                  const stageElapsed = isRunning && stage.startTime 
                    ? Math.floor((Date.now() - stage.startTime.getTime()) / 1000)
                    : stage.duration || 0;

                  return (
                    <div 
                      key={index}
                      className={`p-4 rounded-lg border ${
                        stage.status === "running" ? "border-yellow-500 bg-yellow-500/5" :
                        stage.status === "complete" ? "border-green-500/30 bg-green-500/5" :
                        stage.status === "failed" ? "border-red-500 bg-red-500/5" :
                        "border-border bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-foreground">{stage.name}</div>
                        <span className={`text-lg ${getStageStatusColor(stage.status)}`}>
                          {getStageStatusIcon(stage.status)}
                        </span>
                      </div>
                      
                      {stage.status === "running" && (
                        <Progress value={50} className="mb-2 h-1" />
                      )}
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {stage.status === "pending" ? "Waiting..." :
                           stage.status === "running" ? formatElapsedTime(stageElapsed) :
                           stage.status === "complete" ? formatElapsedTime(stage.duration || 0) :
                           "Failed"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewLogs(deployment, stage.name)}
                          className="h-6 px-2"
                        >
                          <FileText className="h-3 w-3" />
                        </Button>
                      </div>

                      {stage.error && (
                        <div className="mt-2 flex items-start gap-1 text-xs text-red-500">
                          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{stage.error}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}