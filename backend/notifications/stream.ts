import { api, StreamOut } from "encore.dev/api";
import type { DeploymentStatusUpdate } from "./types";
import db from "../db";

interface DeploymentStreamRequest {
  projectId?: number;
  deploymentId?: number;
}

export const streamDeploymentUpdates = api.streamOut<DeploymentStreamRequest, DeploymentStatusUpdate>(
  { 
    method: "GET", 
    path: "/notifications/deployments/stream", 
    expose: true
  },
  async (req, stream) => {
    try {
      const pollingInterval = setInterval(async () => {
        try {
          let query;
          
          if (req.deploymentId) {
            query = db.queryRow<{
              id: number;
              status: string;
              stage: string | null;
              progress: number | null;
              error_message: string | null;
            }>`
              SELECT id, status, stage, progress, error_message
              FROM deployment_logs
              WHERE id = ${req.deploymentId}
              ORDER BY updated_at DESC
              LIMIT 1
            `;
          } else if (req.projectId) {
            query = db.queryRow<{
              id: number;
              status: string;
              stage: string | null;
              progress: number | null;
              error_message: string | null;
            }>`
              SELECT id, status, stage, progress, error_message
              FROM deployment_logs
              WHERE project_id = ${req.projectId}
                AND status IN ('pending', 'in_progress')
              ORDER BY created_at DESC
              LIMIT 1
            `;
          } else {
            query = db.queryRow<{
              id: number;
              status: string;
              stage: string | null;
              progress: number | null;
              error_message: string | null;
            }>`
              SELECT id, status, stage, progress, error_message
              FROM deployment_logs
              WHERE status IN ('pending', 'in_progress')
              ORDER BY created_at DESC
              LIMIT 1
            `;
          }

          const deployment = await query;

          if (deployment) {
            await stream.send({
              deploymentId: deployment.id,
              status: deployment.status as any,
              stage: deployment.stage || undefined,
              progress: deployment.progress || undefined,
              error: deployment.error_message || undefined,
            });
          }
        } catch (error) {
          console.error("Error polling deployment updates:", error);
        }
      }, 2000);

      await new Promise<void>((resolve, reject) => {
        stream.onclose = () => {
          clearInterval(pollingInterval);
          resolve();
        };
        stream.onerror = (err) => {
          clearInterval(pollingInterval);
          reject(err);
        };
      });
    } catch (error) {
      console.error("Stream error:", error);
    }
  }
);