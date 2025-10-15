import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Rocket, AlertTriangle } from "lucide-react";
import type { Project } from "~backend/projects/types";

interface NewDeploymentWizardProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  onDeploy: (projectId: number, environment: "staging" | "production") => void;
}

export function NewDeploymentWizard({ open, onClose, projects, onDeploy }: NewDeploymentWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [environment, setEnvironment] = useState<"staging" | "production">("staging");
  const [checklist, setChecklist] = useState({
    tests_passed: false,
    no_incidents: false,
    breaking_changes_documented: false,
    team_notified: false
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const isChecklistComplete = Object.values(checklist).every(v => v);

  const handleClose = () => {
    setStep(1);
    setSelectedProjectId(null);
    setEnvironment("staging");
    setChecklist({
      tests_passed: false,
      no_incidents: false,
      breaking_changes_documented: false,
      team_notified: false
    });
    onClose();
  };

  const handleDeploy = () => {
    if (selectedProjectId) {
      onDeploy(selectedProjectId, environment);
      handleClose();
    }
  };

  const totalSteps = 4;
  const progressPercentage = (step / totalSteps) * 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            New Deployment
          </DialogTitle>
        </DialogHeader>

        <Progress value={progressPercentage} className="mb-4" />

        <div className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Step 1: Select Project</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose the project you want to deploy
                </p>
              </div>

              <Select 
                value={selectedProjectId?.toString() || ""} 
                onValueChange={(value) => setSelectedProjectId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedProject && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{selectedProject.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">{selectedProject.description}</p>
                    </div>
                    {selectedProject.status && (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        selectedProject.status === "active" ? "bg-green-500/10 text-green-500" :
                        selectedProject.status === "archived" ? "bg-gray-500/10 text-gray-500" :
                        selectedProject.status === "critical" ? "bg-red-500/10 text-red-500" :
                        "bg-yellow-500/10 text-yellow-500"
                      }`}>
                        {selectedProject.status}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Step 2: Select Environment</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose the target deployment environment
                </p>
              </div>

              <div className="grid gap-3">
                <button
                  onClick={() => setEnvironment("staging")}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    environment === "staging" 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold mb-1">Staging</div>
                  <p className="text-sm text-muted-foreground">
                    Deploy to staging environment for testing
                  </p>
                </button>

                <button
                  onClick={() => setEnvironment("production")}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    environment === "production" 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold mb-1 flex items-center gap-2">
                    Production
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Deploy to production environment (requires checklist completion)
                  </p>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Step 3: Pre-deployment Checklist</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Verify all requirements before deploying
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <Checkbox
                    id="tests_passed"
                    checked={checklist.tests_passed}
                    onCheckedChange={(checked) => 
                      setChecklist({ ...checklist, tests_passed: checked as boolean })
                    }
                  />
                  <label htmlFor="tests_passed" className="flex-1 cursor-pointer">
                    <div className="font-medium">All tests passed</div>
                    <p className="text-sm text-muted-foreground">Unit, integration, and E2E tests</p>
                  </label>
                </div>

                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <Checkbox
                    id="no_incidents"
                    checked={checklist.no_incidents}
                    onCheckedChange={(checked) => 
                      setChecklist({ ...checklist, no_incidents: checked as boolean })
                    }
                  />
                  <label htmlFor="no_incidents" className="flex-1 cursor-pointer">
                    <div className="font-medium">No active incidents</div>
                    <p className="text-sm text-muted-foreground">All critical issues resolved</p>
                  </label>
                </div>

                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <Checkbox
                    id="breaking_changes"
                    checked={checklist.breaking_changes_documented}
                    onCheckedChange={(checked) => 
                      setChecklist({ ...checklist, breaking_changes_documented: checked as boolean })
                    }
                  />
                  <label htmlFor="breaking_changes" className="flex-1 cursor-pointer">
                    <div className="font-medium">Breaking changes documented</div>
                    <p className="text-sm text-muted-foreground">Migration guide prepared if needed</p>
                  </label>
                </div>

                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <Checkbox
                    id="team_notified"
                    checked={checklist.team_notified}
                    onCheckedChange={(checked) => 
                      setChecklist({ ...checklist, team_notified: checked as boolean })
                    }
                  />
                  <label htmlFor="team_notified" className="flex-1 cursor-pointer">
                    <div className="font-medium">Team notified</div>
                    <p className="text-sm text-muted-foreground">Stakeholders aware of deployment</p>
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Step 4: Confirm Deployment</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Review your deployment configuration
                </p>
              </div>

              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Project:</span>
                  <span className="font-medium">{selectedProject?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Environment:</span>
                  <span className="font-medium capitalize">{environment}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Checklist:</span>
                  <span className={`font-medium ${isChecklistComplete ? "text-green-500" : "text-yellow-500"}`}>
                    {isChecklistComplete ? "Complete ✓" : "Incomplete"}
                  </span>
                </div>
              </div>

              {!isChecklistComplete && (
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-500">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Please complete all checklist items before deploying</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Step {step} of {totalSteps}
            </div>
            <div className="flex gap-2">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              {step < totalSteps ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={step === 1 && !selectedProjectId}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleDeploy}
                  disabled={!isChecklistComplete}
                >
                  <Rocket className="h-4 w-4 mr-2" />
                  Deploy Now
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}