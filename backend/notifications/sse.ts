import { api, APIError } from "encore.dev/api";
import { messageBus } from "./bus";
import type { DeploymentNotification } from "./types";

interface SSEClient {
  id: string;
  deploymentId?: number;
  projectId?: number;
  send: (data: string) => void;
  close: () => void;
}

const activeClients = new Map<string, SSEClient>();

export interface StreamDeploymentEventsRequest {
  deploymentId?: number;
  projectId?: number;
}

export const streamDeploymentEvents = api.raw(
  { 
    method: "GET",
    path: "/notifications/deployments/events", 
    expose: true 
  },
  async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const deploymentId = url.searchParams.get('deploymentId');
    const projectId = url.searchParams.get('projectId');
    
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    
    const send = (data: string) => {
      if (!res.writableEnded) {
        res.write(data);
      }
    };
    
    const close = () => {
      if (!res.writableEnded) {
        res.end();
      }
    };
    
    const client: SSEClient = {
      id: clientId,
      deploymentId: deploymentId ? parseInt(deploymentId) : undefined,
      projectId: projectId ? parseInt(projectId) : undefined,
      send,
      close,
    };
    
    activeClients.set(clientId, client);
    
    send(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);
    
    const channel = deploymentId 
      ? `deployment:${deploymentId}` 
      : projectId 
        ? `project:${projectId}` 
        : 'all';
    
    const unsubscribe = messageBus.subscribe(channel, (notification: DeploymentNotification) => {
      if (shouldSendToClient(client, notification)) {
        send(`data: ${JSON.stringify({ type: 'notification', data: notification })}\n\n`);
      }
    });
    
    const heartbeatInterval = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeatInterval);
        return;
      }
      send(`: heartbeat ${Date.now()}\n\n`);
    }, 15000);
    
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      unsubscribe();
      activeClients.delete(clientId);
    });
    
    req.on('error', () => {
      clearInterval(heartbeatInterval);
      unsubscribe();
      activeClients.delete(clientId);
      close();
    });
  }
);

function shouldSendToClient(client: SSEClient, notification: DeploymentNotification): boolean {
  if (client.deploymentId && client.deploymentId !== notification.deploymentId) {
    return false;
  }
  
  if (client.projectId && client.projectId !== notification.projectId) {
    return false;
  }
  
  return true;
}

export async function broadcastDeploymentNotification(notification: DeploymentNotification): Promise<void> {
  await messageBus.publish(`deployment:${notification.deploymentId}`, notification);
  await messageBus.publish(`project:${notification.projectId}`, notification);
  await messageBus.publish('all', notification);
}

export function getActiveClientCount(): number {
  return activeClients.size;
}

export function getActiveClientsForDeployment(deploymentId: number): number {
  let count = 0;
  activeClients.forEach(client => {
    if (client.deploymentId === deploymentId) {
      count++;
    }
  });
  return count;
}
