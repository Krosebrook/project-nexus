import { useEffect } from 'react';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { useDeploymentFeed } from '../hooks/useDeploymentFeed';
import { useToast } from './ui/use-toast';
import type { DeploymentNotification } from '../hooks/useDeploymentFeed';

interface DeploymentToastProps {
  projectId?: number;
  deploymentId?: number;
  enabled?: boolean;
}

export function DeploymentToast({ projectId, deploymentId, enabled = true }: DeploymentToastProps) {
  const { toast } = useToast();
  const { notifications, isConnected, error } = useDeploymentFeed({
    projectId,
    deploymentId,
    enabled,
  });

  useEffect(() => {
    if (error) {
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to deployment notifications',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  useEffect(() => {
    if (notifications.length === 0) return;

    const latestNotification = notifications[notifications.length - 1];
    showNotificationToast(latestNotification, toast);
  }, [notifications, toast]);

  return null;
}

function showNotificationToast(
  notification: DeploymentNotification,
  toast: ReturnType<typeof useToast>['toast']
) {
  const { status, projectName, environmentName, message, stage, progress } = notification;

  let icon;
  let variant: 'default' | 'destructive' = 'default';
  let title: string;
  let description: string;

  switch (status) {
    case 'started':
      icon = <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      title = 'Deployment Started';
      description = `${projectName} to ${environmentName}`;
      break;

    case 'in_progress':
      icon = <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      title = stage ? `Stage: ${stage}` : 'Deployment In Progress';
      description = progress 
        ? `${projectName} - ${progress}%` 
        : `${projectName} to ${environmentName}`;
      break;

    case 'success':
      icon = <CheckCircle2 className="h-5 w-5 text-green-500" />;
      title = 'Deployment Successful';
      description = `${projectName} deployed to ${environmentName}`;
      break;

    case 'failed':
      icon = <XCircle className="h-5 w-5 text-red-500" />;
      variant = 'destructive';
      title = 'Deployment Failed';
      description = message || `${projectName} deployment to ${environmentName} failed`;
      break;

    default:
      icon = <AlertCircle className="h-5 w-5 text-yellow-500" />;
      title = 'Deployment Update';
      description = message || `${projectName} - ${environmentName}`;
  }

  toast({
    title: (
      <div className="flex items-center gap-2">
        {icon}
        <span>{title}</span>
      </div>
    ) as any,
    description,
    variant,
    duration: status === 'success' || status === 'failed' ? 5000 : 3000,
  });
}

interface DeploymentFeedIndicatorProps {
  projectId?: number;
  deploymentId?: number;
}

export function DeploymentFeedIndicator({ projectId, deploymentId }: DeploymentFeedIndicatorProps) {
  const { isConnected, reconnectAttempts } = useDeploymentFeed({
    projectId,
    deploymentId,
    enabled: true,
  });

  if (isConnected) {
    return (
      <div 
        className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
        role="status"
        aria-live="polite"
      >
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="sr-only">Connected to deployment feed</span>
      </div>
    );
  }

  if (reconnectAttempts > 0) {
    return (
      <div 
        className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="sr-only">Reconnecting... (Attempt {reconnectAttempts})</span>
      </div>
    );
  }

  return null;
}
