import { api } from "encore.dev/api";
import db from "../db";
import type { DeploymentProgress } from "./types";

export const status = api(
  { method: "GET", path: "/deployments/:id/status", expose: true },
  async ({ id }: { id: number }): Promise<DeploymentProgress> => {
    const result = await db.queryRow<DeploymentProgress>`
      SELECT id, status, stage, progress, logs
      FROM deployment_logs
      WHERE id = ${id}
    `;
    if (!result) throw new Error('Deployment not found');
    return result;
  }
);