import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  onDeploymentUpdate?: (data: { deployment_id: string; status: string }) => void;
  onSyncEvent?: (event: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket(options?: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const socket = io(import.meta.env.VITE_API_URL || '', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      setIsConnected(true);
      options?.onConnect?.();
    });

    socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      setIsConnected(false);
      options?.onDisconnect?.();
    });

    socket.on('deployment:status', (data) => {
      options?.onDeploymentUpdate?.(data);
    });

    socket.on('sync:event', (event) => {
      options?.onSyncEvent?.(event);
    });

    return () => {
      socket.disconnect();
    };
  }, [options]);

  const subscribe = (entity: string, id: string) => {
    socketRef.current?.emit('subscribe', { entity, id });
  };

  const unsubscribe = (entity: string, id: string) => {
    socketRef.current?.emit('unsubscribe', { entity, id });
  };

  return { isConnected, subscribe, unsubscribe };
}
