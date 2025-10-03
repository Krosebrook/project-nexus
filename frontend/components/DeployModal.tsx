import { useState, useEffect } from 'react';
import { X, Rocket, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import backend from '~backend/client';
import type { Project } from '~backend/projects/types';

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

export function DeployModal({ isOpen, onClose, project }: DeployModalProps) {
  const [environment, setEnvironment] = useState<string>('staging');
  const [checklist, setChecklist] = useState({
    tests_passed: false,
    breaking_changes_documented: false,
    migrations_ready: false
  });
  const [deploying, setDeploying] = useState(false);
  const [deploymentId, setDeploymentId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [stage, setStage] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string>('');

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  useEffect(() => {
    if (deploymentId && deploying) {
      const interval = setInterval(async () => {
        try {
          const result = await backend.deployments.status({ id: deploymentId });
          setStatus(result.status);
          setStage(result.stage);
          setProgress(result.progress);
          setLogs(result.logs);

          if (result.status === 'success' || result.status === 'failed') {
            setDeploying(false);
            clearInterval(interval);
          }
        } catch (error) {
          console.error('Failed to fetch deployment status:', error);
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [deploymentId, deploying]);

  const resetState = () => {
    setEnvironment('staging');
    setChecklist({
      tests_passed: false,
      breaking_changes_documented: false,
      migrations_ready: false
    });
    setDeploying(false);
    setDeploymentId(null);
    setStatus('idle');
    setStage('');
    setProgress(0);
    setLogs('');
  };

  const isChecklistComplete = Object.values(checklist).every(v => v);

  const handleDeploy = async () => {
    if (!project || !isChecklistComplete) return;

    setDeploying(true);
    try {
      const result = await backend.deployments.deploy({
        project_id: project.id,
        environment,
        checklist
      });
      setDeploymentId(result.id);
      setStatus(result.status);
      setStage(result.stage);
      setProgress(result.progress);
      setLogs(result.logs);
    } catch (error) {
      console.error('Failed to start deployment:', error);
      setDeploying(false);
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!deploying ? onClose : undefined} />
      <div className="relative w-full max-w-md bg-background border rounded-lg shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Rocket className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold">Deploy Project</h2>
          </div>
          {!deploying && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        <div className="p-6 space-y-6">
          {!deploying ? (
            <>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Project</p>
                <p className="font-medium">{project.name}</p>
                {project.version && (
                  <p className="text-xs text-muted-foreground">Version: {project.version}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Environment</label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-3 block">Pre-deployment Checklist</label>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="tests"
                      checked={checklist.tests_passed}
                      onCheckedChange={(checked) => 
                        setChecklist({ ...checklist, tests_passed: checked as boolean })
                      }
                    />
                    <label htmlFor="tests" className="text-sm cursor-pointer">
                      Tests passed
                    </label>
                  </div>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="breaking"
                      checked={checklist.breaking_changes_documented}
                      onCheckedChange={(checked) => 
                        setChecklist({ ...checklist, breaking_changes_documented: checked as boolean })
                      }
                    />
                    <label htmlFor="breaking" className="text-sm cursor-pointer">
                      Breaking changes documented
                    </label>
                  </div>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="migrations"
                      checked={checklist.migrations_ready}
                      onCheckedChange={(checked) => 
                        setChecklist({ ...checklist, migrations_ready: checked as boolean })
                      }
                    />
                    <label htmlFor="migrations" className="text-sm cursor-pointer">
                      Database migrations ready
                    </label>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleDeploy} 
                disabled={!isChecklistComplete}
                className="w-full"
              >
                <Rocket className="w-4 h-4 mr-2" />
                Confirm Deploy to {environment.charAt(0).toUpperCase() + environment.slice(1)}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{stage} Stage</span>
                    <span className="text-muted-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                <div className="bg-muted rounded-lg p-4 font-mono text-xs h-48 overflow-y-auto">
                  <pre className="whitespace-pre-wrap">{logs}</pre>
                </div>

                {status === 'success' && (
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Deployment successful!</span>
                  </div>
                )}

                {status === 'failed' && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">Deployment failed</span>
                  </div>
                )}

                {status === 'running' && (
                  <div className="flex items-center gap-2 p-3 bg-primary/10 text-primary rounded-lg">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-medium">Deploying...</span>
                  </div>
                )}
              </div>

              {(status === 'success' || status === 'failed') && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose} className="flex-1">
                    Close
                  </Button>
                  <Button variant="outline" className="flex-1">
                    View Logs
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}