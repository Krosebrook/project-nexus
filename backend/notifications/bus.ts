import type { DeploymentNotification } from "./types";

export interface MessageBusAdapter {
  publish(channel: string, message: DeploymentNotification): Promise<void>;
  subscribe(channel: string, handler: (message: DeploymentNotification) => void): () => void;
}

interface Subscriber {
  id: string;
  handler: (message: DeploymentNotification) => void;
}

export class InMemoryMessageBus implements MessageBusAdapter {
  private channels = new Map<string, Map<string, Subscriber>>();
  private messageHistory = new Map<string, Array<{ key: string; message: DeploymentNotification; timestamp: number }>>();
  private readonly historyLimit = 100;

  async publish(channel: string, message: DeploymentNotification): Promise<void> {
    const messageKey = this.getMessageKey(message);
    
    if (!this.messageHistory.has(channel)) {
      this.messageHistory.set(channel, []);
    }
    
    const history = this.messageHistory.get(channel)!;
    const isDuplicate = history.some(h => h.key === messageKey && Date.now() - h.timestamp < 5000);
    
    if (isDuplicate) {
      return;
    }
    
    history.push({ key: messageKey, message, timestamp: Date.now() });
    
    if (history.length > this.historyLimit) {
      history.shift();
    }
    
    const subscribers = this.channels.get(channel);
    if (subscribers) {
      subscribers.forEach(subscriber => {
        try {
          subscriber.handler(message);
        } catch (error) {
          console.error(`Error in subscriber ${subscriber.id}:`, error);
        }
      });
    }
  }

  subscribe(channel: string, handler: (message: DeploymentNotification) => void): () => void {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Map());
    }
    
    const subscribers = this.channels.get(channel)!;
    const subscriberId = `${channel}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    subscribers.set(subscriberId, { id: subscriberId, handler });
    
    return () => {
      const channelSubscribers = this.channels.get(channel);
      if (channelSubscribers) {
        channelSubscribers.delete(subscriberId);
        
        if (channelSubscribers.size === 0) {
          this.channels.delete(channel);
          this.messageHistory.delete(channel);
        }
      }
    };
  }

  getSubscriberCount(channel?: string): number {
    if (channel) {
      return this.channels.get(channel)?.size ?? 0;
    }
    
    let total = 0;
    this.channels.forEach(subscribers => {
      total += subscribers.size;
    });
    return total;
  }

  private getMessageKey(message: DeploymentNotification): string {
    return `${message.deploymentId}-${message.status}-${message.stage || 'none'}-${message.progress || 0}`;
  }
}

export const messageBus = new InMemoryMessageBus();
