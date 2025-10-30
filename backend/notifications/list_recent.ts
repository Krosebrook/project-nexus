import { api } from "encore.dev/api";
import db from "../db";

export interface ListRecentNotificationsRequest {
  limit?: number;
  projectId?: number;
}

export interface NotificationEntry {
  id: number;
  deploymentId: number;
  projectName: string;
  environmentName: string;
  status: string;
  message: string;
  timestamp: Date;
}

export interface ListRecentNotificationsResponse {
  notifications: NotificationEntry[];
}

export const listRecent = api(
  { method: "GET", path: "/notifications/recent", expose: true },
  async (req: ListRecentNotificationsRequest): Promise<ListRecentNotificationsResponse> => {
    const limit = req.limit || 20;
    
    let notifications;

    if (req.projectId) {
      notifications = await db.queryAll<{
        id: number;
        deployment_id: number;
        project_name: string;
        environment_name: string;
        status: string;
        message: string;
        timestamp: Date;
      }>`
        SELECT 
          id,
          deployment_id,
          project_name,
          environment_name,
          status,
          message,
          timestamp
        FROM deployment_notification_history
        WHERE project_id = ${req.projectId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else {
      notifications = await db.queryAll<{
        id: number;
        deployment_id: number;
        project_name: string;
        environment_name: string;
        status: string;
        message: string;
        timestamp: Date;
      }>`
        SELECT 
          id,
          deployment_id,
          project_name,
          environment_name,
          status,
          message,
          timestamp
        FROM deployment_notification_history
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    return {
      notifications: notifications.map((n: any) => ({
        id: n.id,
        deploymentId: n.deployment_id,
        projectName: n.project_name,
        environmentName: n.environment_name,
        status: n.status,
        message: n.message,
        timestamp: n.timestamp,
      }))
    };
  }
);
