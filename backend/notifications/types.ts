export interface DeploymentNotification {
  deploymentId: number;
  projectId: number;
  projectName: string;
  environmentName: string;
  status: 'started' | 'in_progress' | 'success' | 'failed';
  stage?: string;
  progress?: number;
  message?: string;
  timestamp: Date;
}

export interface DeploymentStatusUpdate {
  deploymentId: number;
  status: 'pending' | 'in_progress' | 'success' | 'failed';
  stage?: string;
  progress?: number;
  error?: string;
}