import { useState, useEffect } from 'react';
import { X, Bell, BellOff, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import backend from '~backend/client';
import { Badge } from './ui/badge';
import { useToast } from './ui/use-toast';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface NotificationHistoryEntry {
  id: number;
  deploymentId: number;
  projectName: string;
  environmentName: string;
  status: string;
  message: string;
  timestamp: Date;
}

interface NotificationHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationHistorySidebar({ isOpen, onClose }: NotificationHistorySidebarProps) {
  const [history, setHistory] = useState<NotificationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutedProjects, setMutedProjects] = useLocalStorage<string[]>('mutedProjects', []);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await backend.notifications.listRecent({ limit: 20 });
      setHistory(response.notifications.map(n => ({
        ...n,
        timestamp: new Date(n.timestamp)
      })));
    } catch (error) {
      console.error('Failed to load notification history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notification history',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMuteProject = (projectName: string) => {
    setMutedProjects(prev => {
      if (prev.includes(projectName)) {
        return prev.filter(p => p !== projectName);
      }
      return [...prev, projectName];
    });
  };

  const isProjectMuted = (projectName: string) => {
    return mutedProjects.includes(projectName);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded':
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'succeeded':
      case 'success':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'running':
      case 'in_progress':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 bg-background border-l shadow-lg">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Notifications</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-73px)]">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {history.map((notification) => (
              <div
                key={notification.id}
                className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => {
                  window.location.href = `/deployments/${notification.deploymentId}`;
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getStatusIcon(notification.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">
                        {notification.projectName}
                      </p>
                      <Badge variant={getStatusColor(notification.status)} className="text-xs">
                        {notification.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {notification.environmentName}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(notification.timestamp)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMuteProject(notification.projectName);
                        }}
                      >
                        {isProjectMuted(notification.projectName) ? (
                          <>
                            <BellOff className="h-3 w-3 mr-1" />
                            <span className="text-xs">Unmute</span>
                          </>
                        ) : (
                          <>
                            <Bell className="h-3 w-3 mr-1" />
                            <span className="text-xs">Mute</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
