import { api } from "encore.dev/api";
import { Subscription } from "encore.dev/pubsub";
import { deploymentNotificationTopic } from "./topics";
import type { DeploymentNotification } from "./types";
import db from "../db";

interface NotificationHistoryEntry {
  id: number;
  deploymentId: number;
  projectId: number;
  projectName: string;
  environmentName: string;
  status: string;
  stage?: string;
  progress?: number;
  message: string;
  timestamp: Date;
  createdAt: Date;
}

const notificationHistory: Map<number, NotificationHistoryEntry[]> = new Map();

const deploymentNotificationSubscription = new Subscription(
  deploymentNotificationTopic,
  "store-notifications",
  {
    handler: async (notification: DeploymentNotification) => {
      try {
        await db.exec`
          INSERT INTO deployment_notification_history (
            deployment_id,
            project_id,
            project_name,
            environment_name,
            status,
            stage,
            progress,
            message,
            timestamp
          ) VALUES (
            ${notification.deploymentId},
            ${notification.projectId},
            ${notification.projectName},
            ${notification.environmentName},
            ${notification.status},
            ${notification.stage || null},
            ${notification.progress || null},
            ${notification.message},
            ${notification.timestamp}
          )
        `;

        if (!notificationHistory.has(notification.deploymentId)) {
          notificationHistory.set(notification.deploymentId, []);
        }

        const history = notificationHistory.get(notification.deploymentId)!;
        history.push({
          id: Date.now(),
          deploymentId: notification.deploymentId,
          projectId: notification.projectId,
          projectName: notification.projectName,
          environmentName: notification.environmentName,
          status: notification.status,
          stage: notification.stage,
          progress: notification.progress,
          message: notification.message || '',
          timestamp: notification.timestamp,
          createdAt: new Date(),
        });

        if (history.length > 100) {
          history.shift();
        }
      } catch (error) {
        console.error("Failed to store deployment notification:", error);
      }
    },
  }
);

export interface GetNotificationHistoryRequest {
  deploymentId: number;
}

export interface GetNotificationHistoryResponse {
  history: NotificationHistoryEntry[];
}

export const getNotificationHistory = api(
  { method: "GET", path: "/notifications/history/:deploymentId", expose: true },
  async ({ deploymentId }: GetNotificationHistoryRequest): Promise<GetNotificationHistoryResponse> => {
    const dbHistory = await db.queryAll<{
      id: number;
      deployment_id: number;
      project_id: number;
      project_name: string;
      environment_name: string;
      status: string;
      stage: string | null;
      progress: number | null;
      message: string;
      timestamp: Date;
      created_at: Date;
    }>`
      SELECT *
      FROM deployment_notification_history
      WHERE deployment_id = ${deploymentId}
      ORDER BY created_at DESC
      LIMIT 100
    `;

    return {
      history: dbHistory.map((entry) => ({
        id: entry.id,
        deploymentId: entry.deployment_id,
        projectId: entry.project_id,
        projectName: entry.project_name,
        environmentName: entry.environment_name,
        status: entry.status,
        stage: entry.stage || undefined,
        progress: entry.progress || undefined,
        message: entry.message,
        timestamp: entry.timestamp,
        createdAt: entry.created_at,
      }))
    };
  }
);

export const streamRealtimeNotifications = api.streamOut<
  { projectId?: number },
  DeploymentNotification
>(
  {
    path: "/notifications/realtime/stream",
    expose: true,
  },
  async (req, stream) => {
    try {
      await new Promise<void>(() => {});
    } catch (error) {
      console.error("Stream error:", error);
    }
  }
);
