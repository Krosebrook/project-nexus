import { useEffect, useRef, useState, useCallback } from 'react';

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

interface SSEMessage {
  type: 'connected' | 'notification';
  clientId?: string;
  data?: DeploymentNotification;
}

interface UseDeploymentFeedOptions {
  deploymentId?: number;
  projectId?: number;
  enabled?: boolean;
  onNotification?: (notification: DeploymentNotification) => void;
  maxReconnectAttempts?: number;
  baseReconnectDelay?: number;
}

interface UseDeploymentFeedReturn {
  notifications: DeploymentNotification[];
  isConnected: boolean;
  error: Error | null;
  reconnectAttempts: number;
  clearNotifications: () => void;
}

export function useDeploymentFeed(options: UseDeploymentFeedOptions = {}): UseDeploymentFeedReturn {
  const {
    deploymentId,
    projectId,
    enabled = true,
    onNotification,
    maxReconnectAttempts = 10,
    baseReconnectDelay = 1000,
  } = options;

  const [notifications, setNotifications] = useState<DeploymentNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current) {
      return;
    }

    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    try {
      const params = new URLSearchParams();
      if (deploymentId) {
        params.set('deploymentId', deploymentId.toString());
      }
      if (projectId) {
        params.set('projectId', projectId.toString());
      }

      const baseUrl = import.meta.env.VITE_CLIENT_TARGET || '';
      const url = `${baseUrl}/notifications/deployments/events${params.toString() ? `?${params.toString()}` : ''}`;
      const eventSource = new EventSource(url);

      eventSource.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        setError(null);
        setReconnectAttempts(0);
      };

      eventSource.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const message: SSEMessage = JSON.parse(event.data);

          if (message.type === 'notification' && message.data) {
            const notification: DeploymentNotification = {
              ...message.data,
              timestamp: new Date(message.data.timestamp),
            };

            setNotifications((prev) => {
              const isDuplicate = prev.some(
                (n) =>
                  n.deploymentId === notification.deploymentId &&
                  n.status === notification.status &&
                  n.stage === notification.stage &&
                  n.progress === notification.progress
              );

              if (isDuplicate) {
                return prev;
              }

              return [...prev, notification];
            });

            onNotification?.(notification);
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = () => {
        if (!mountedRef.current) return;

        setIsConnected(false);
        eventSource.close();

        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(
            baseReconnectDelay * Math.pow(2, reconnectAttempts),
            30000
          );
          const jitter = Math.random() * 1000;
          const finalDelay = delay + jitter;

          setReconnectAttempts((prev) => prev + 1);

          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, finalDelay);
        } else {
          setError(new Error('Max reconnection attempts reached'));
        }
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to connect'));
      setIsConnected(false);
    }
  }, [enabled, deploymentId, projectId, reconnectAttempts, maxReconnectAttempts, baseReconnectDelay, onNotification]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [enabled, deploymentId, projectId, connect, disconnect]);

  return {
    notifications,
    isConnected,
    error,
    reconnectAttempts,
    clearNotifications,
  };
}
