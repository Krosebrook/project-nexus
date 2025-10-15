import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { DeploymentStatsCards } from "./DeploymentStatsCards";
import { DeploymentTimeline } from "./DeploymentTimeline";
import { RecentDeploymentsList } from "./RecentDeploymentsList";
import { ActiveDeploymentTracker } from "./ActiveDeploymentTracker";
import { DeploymentDetailsModal } from "./DeploymentDetailsModal";
import { NewDeploymentWizard } from "./NewDeploymentWizard";
import { LogsModal } from "./LogsModal";
import { useToast } from "@/components/ui/use-toast";
import { mockDeployments } from "@/lib/deployment-data";
import type { Deployment } from "@/lib/deployment-data";
import type { Project } from "~backend/projects/types";
import backend from "~backend/client";

interface DeploymentTabProps {
  project: Project;
}

export function DeploymentTab({ project }: DeploymentTabProps) {
  const [deployments, setDeployments] = useState<Deployment[]>(mockDeployments);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [logsData, setLogsData] = useState<{ deployment: Deployment; stage?: string } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDeployments(prev => {
        return prev.map(deployment => {
          if (deployment.status === "in_progress") {
            const runningStageIndex = deployment.stages.findIndex(s => s.status === "running");
            if (runningStageIndex !== -1) {
              const updatedStages = [...deployment.stages];
              const currentStage = { ...updatedStages[runningStageIndex] };
              
              if (currentStage.startTime) {
                const elapsedSeconds = Math.floor((Date.now() - currentStage.startTime.getTime()) / 1000);
                if (elapsedSeconds > 60) {
                  currentStage.status = "complete";
                  currentStage.duration = elapsedSeconds;
                  updatedStages[runningStageIndex] = currentStage;

                  if (runningStageIndex < updatedStages.length - 1) {
                    updatedStages[runningStageIndex + 1] = {
                      ...updatedStages[runningStageIndex + 1],
                      status: "running",
                      startTime: new Date()
                    };
                  } else {
                    return {
                      ...deployment,
                      status: "success" as const,
                      stages: updatedStages,
                      duration: deployment.stages.reduce((sum, s) => sum + (s.duration || 0), 0)
                    };
                  }
                }
              }

              return {
                ...deployment,
                stages: updatedStages,
                duration: Math.floor((Date.now() - deployment.timestamp.getTime()) / 1000)
              };
            }
          }
          return deployment;
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadProjects = async () => {
    try {
      const result = await backend.projects.list();
      setProjects(result.projects);
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  };

  const handleSelectDeployment = (deployment: Deployment) => {
    setSelectedDeployment(deployment);
    setDetailsModalOpen(true);
  };

  const handleViewLogs = (deployment: Deployment, stage?: string) => {
    setLogsData({ deployment, stage });
    setLogsModalOpen(true);
  };

  const handleRollback = (deployment: Deployment) => {
    toast({
      title: "Rollback initiated",
      description: `Rolling back ${deployment.projectName} ${deployment.version}`,
    });
  };

  const handleRerun = (deployment: Deployment) => {
    toast({
      title: "Deployment queued",
      description: `Re-running deployment for ${deployment.projectName} ${deployment.version}`,
    });
  };

  const handleViewFullLogs = (deployment: Deployment) => {
    handleViewLogs(deployment);
    setDetailsModalOpen(false);
  };

  const handleNewDeployment = (projectId: number, environment: "staging" | "production") => {
    const targetProject = projects.find(p => p.id === projectId);
    if (!targetProject) return;

    const newDeployment: Deployment = {
      id: `deploy_${Date.now()}`,
      projectId: projectId,
      projectName: targetProject.name,
      version: "v1.0.0",
      status: "in_progress",
      duration: 0,
      timestamp: new Date(),
      environment: environment,
      commit: {
        hash: "abc123d",
        author: "You",
        authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=You",
        message: "New deployment",
        timestamp: new Date(),
        githubUrl: "https://github.com"
      },
      stages: [
        { name: "Build", status: "running", startTime: new Date() },
        { name: "Test", status: "pending" },
        { name: "Deploy Staging", status: "pending" },
        { name: "Deploy Production", status: "pending" }
      ]
    };

    setDeployments(prev => [newDeployment, ...prev]);
    
    toast({
      title: "Deployment started",
      description: `Deploying ${targetProject.name} to ${environment}`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">CI/CD Monitoring</h2>
          <p className="text-muted-foreground">Track and manage deployments across all environments</p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Deployment
        </Button>
      </div>

      <DeploymentStatsCards deployments={deployments} />

      <ActiveDeploymentTracker 
        deployments={deployments}
        onViewLogs={handleViewLogs}
      />

      <DeploymentTimeline
        deployments={deployments}
        onSelectDeployment={handleSelectDeployment}
      />

      <RecentDeploymentsList
        deployments={deployments}
        onViewLogs={handleViewLogs}
        onViewDetails={handleSelectDeployment}
        onRollback={handleRollback}
        onRerun={handleRerun}
      />

      <DeploymentDetailsModal
        deployment={selectedDeployment}
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        onRollback={handleRollback}
        onRerun={handleRerun}
        onViewFullLogs={handleViewFullLogs}
      />

      <NewDeploymentWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        projects={projects}
        onDeploy={handleNewDeployment}
      />

      <LogsModal
        isOpen={logsModalOpen}
        onClose={() => setLogsModalOpen(false)}
        project={projects.find(p => p.id === logsData?.deployment.projectId) || null}
      />
    </div>
  );
}