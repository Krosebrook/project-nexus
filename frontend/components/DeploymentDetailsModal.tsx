import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ExternalLink, RotateCcw, Play, ChevronDown, Package } from "lucide-react";
import { useState } from "react";
import { formatDuration, getStatusColor } from "@/lib/deployment-data";
import type { Deployment, DeploymentStageInfo } from "@/lib/deployment-data";

interface DeploymentDetailsModalProps {
  deployment: Deployment | null;
  open: boolean;
  onClose: () => void;
  onRollback: (deployment: Deployment) => void;
  onRerun: (deployment: Deployment) => void;
  onViewFullLogs: (deployment: Deployment) => void;
}

export function DeploymentDetailsModal({
  deployment,
  open,
  onClose,
  onRollback,
  onRerun,
  onViewFullLogs
}: DeploymentDetailsModalProps) {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);

  if (!deployment) return null;

  const toggleStage = (stageName: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageName)) {
        next.delete(stageName);
      } else {
        next.add(stageName);
      }
      return next;
    });
  };

  const getStageStatusBadge = (stage: DeploymentStageInfo) => {
    const colors = {
      complete: "bg-green-500/10 text-green-500",
      running: "bg-yellow-500/10 text-yellow-500",
      failed: "bg-red-500/10 text-red-500",
      pending: "bg-gray-500/10 text-gray-500"
    };

    return (
      <Badge className={colors[stage.status]}>
        {stage.status}
      </Badge>
    );
  };

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent data-testid="deployment-details-modal" className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">{deployment.projectName}</DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="font-mono">{deployment.version}</Badge>
                <Badge data-testid="deployment-status-badge" className={getStatusColor(deployment.status)}>
                  {deployment.status.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className="capitalize">{deployment.environment}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              {deployment.status === "failed" && (
                <Button
                  data-testid="rollback-btn"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRollbackDialog(true)}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Rollback
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRerun(deployment)}
              >
                <Play className="h-4 w-4 mr-2" />
                Rerun
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">Commit Information</h3>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <img 
                  src={deployment.commit.authorAvatar} 
                  alt={deployment.commit.author}
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">{deployment.commit.author}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatTimestamp(deployment.commit.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mb-2">{deployment.commit.message}</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-background px-2 py-1 rounded font-mono">
                      {deployment.commit.hash}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => window.open(deployment.commit.githubUrl, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      GitHub
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Deployment Stages</h3>
            <div className="space-y-2">
              {deployment.stages.map((stage, index) => (
                <Collapsible
                  key={index}
                  open={expandedStages.has(stage.name)}
                  onOpenChange={() => toggleStage(stage.name)}
                >
                  <div data-testid={`timeline-step-${stage.name.toLowerCase().replace(/\s+/g, '_')}`} className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${
                              expandedStages.has(stage.name) ? "transform rotate-180" : ""
                            }`}
                          />
                          <span className="font-medium">{stage.name}</span>
                          {getStageStatusBadge(stage)}
                        </div>
                        <div className="flex items-center gap-4">
                          {stage.duration && (
                            <span className="text-sm text-muted-foreground">
                              {formatDuration(stage.duration)}
                            </span>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t bg-muted/30 p-4">
                        {stage.error && (
                          <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-500">
                            <strong>Error:</strong> {stage.error}
                          </div>
                        )}
                        {stage.logs ? (
                          <pre className="text-xs bg-background p-3 rounded overflow-x-auto font-mono">
                            {stage.logs}
                          </pre>
                        ) : (
                          <p className="text-sm text-muted-foreground">No logs available</p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </div>

          {deployment.artifacts && deployment.artifacts.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Artifacts</h3>
              <div className="space-y-2">
                {deployment.artifacts.map((artifact, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg"
                  >
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-mono flex-1">{artifact}</span>
                    <Button variant="ghost" size="sm" className="h-7">
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button data-testid="view-logs-btn" onClick={() => onViewFullLogs(deployment)}>
              View Full Deployment Logs
            </Button>
          </div>
        </div>
      </DialogContent>

      <Dialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <DialogContent data-testid="rollback-confirmation-dialog">
          <DialogHeader>
            <DialogTitle>Confirm Rollback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to rollback deployment {deployment.version}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRollbackDialog(false)}>
                Cancel
              </Button>
              <Button 
                data-testid="confirm-rollback-btn"
                variant="destructive"
                onClick={() => {
                  setShowRollbackDialog(false);
                  onRollback(deployment);
                }}
              >
                Confirm Rollback
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}