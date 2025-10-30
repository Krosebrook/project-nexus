import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Table } from './ui/table';
import { Clock, Play, Pause, X, AlertCircle } from 'lucide-react';
import backend from '~backend/client';
import { useToast } from './ui/use-toast';

interface QueuedDeployment {
  id: number;
  deploymentId: number;
  projectId: number;
  projectName: string;
  environment: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  scheduledFor: Date;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  queuePosition: number;
  estimatedStartTime?: Date;
  createdAt: Date;
}

export function DeploymentQueueView() {
  const [queue, setQueue] = useState<QueuedDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadQueue = async () => {
    try {
      const response = await backend.deployments.listQueue({ limit: 100 });
      setQueue(response.queue.map((q: any) => ({
        ...q,
        scheduledFor: new Date(q.scheduledFor),
        estimatedStartTime: q.estimatedStartTime ? new Date(q.estimatedStartTime) : undefined,
        createdAt: new Date(q.createdAt)
      })));
    } catch (error) {
      console.error('Failed to load queue:', error);
      toast({
        title: 'Error',
        description: 'Failed to load deployment queue',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (queueId: number) => {
    try {
      await backend.deployments.cancelQueued({ queueId });
      toast({
        title: 'Success',
        description: 'Deployment cancelled successfully'
      });
      loadQueue();
    } catch (error) {
      console.error('Failed to cancel deployment:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel deployment',
        variant: 'destructive'
      });
    }
  };

  const getPriorityColor = (priority: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (priority) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'default';
      case 'normal':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusColor = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'running':
        return 'default';
      case 'queued':
        return 'secondary';
      case 'completed':
        return 'outline';
      case 'failed':
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4" />;
      case 'queued':
        return <Clock className="h-4 w-4" />;
      case 'cancelled':
        return <X className="h-4 w-4" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (diff < 0) return 'Now';
    if (minutes < 60) return `in ${minutes}m`;
    if (hours < 24) return `in ${hours}h`;
    return formatTime(date);
  };

  const queuedItems = queue.filter(q => q.status === 'queued');
  const runningItems = queue.filter(q => q.status === 'running');
  const completedItems = queue.filter(q => ['completed', 'failed', 'cancelled'].includes(q.status));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Running Deployments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runningItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deployments currently running</p>
          ) : (
            <div className="space-y-3">
              {runningItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="animate-pulse">
                      {getStatusIcon(item.status)}
                    </div>
                    <div>
                      <p className="font-medium">{item.projectName}</p>
                      <p className="text-sm text-muted-foreground">{item.environment}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getPriorityColor(item.priority)}>
                      {item.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Queued Deployments ({queuedItems.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {queuedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deployments in queue</p>
          ) : (
            <div className="space-y-2">
              {queuedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      {item.queuePosition}
                    </div>
                    <div>
                      <p className="font-medium">{item.projectName}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.environment} • Scheduled for {formatTime(item.scheduledFor)}
                      </p>
                      {item.estimatedStartTime && (
                        <p className="text-xs text-muted-foreground">
                          Estimated start: {formatRelativeTime(item.estimatedStartTime)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getPriorityColor(item.priority)} className="capitalize">
                      {item.priority}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancel(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {completedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedItems.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(item.status)}
                    <div>
                      <p className="text-sm font-medium">{item.projectName}</p>
                      <p className="text-xs text-muted-foreground">{item.environment}</p>
                    </div>
                  </div>
                  <Badge variant={getStatusColor(item.status)} className="capitalize">
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
