import { api, APIError } from "encore.dev/api";
import db from "../db";
import { PROVIDERS } from "../config/providers";
import { neonApiKey, gcpProjectId, gcpSaKey } from "../config/secrets";
import type { ProvisionDatabaseRequest, ProvisionedDatabase } from "./types";

export const provision = api(
  { method: "POST", path: "/provisioning/databases", expose: true },
  async (req: ProvisionDatabaseRequest): Promise<ProvisionedDatabase> => {
    const { projectId, provider, region = "aws-us-east-2", name } = req;

    const projectCheck = await db.queryRow`
      SELECT id FROM projects WHERE id = ${projectId}
    `;

    if (!projectCheck) {
      throw APIError.notFound("Project not found");
    }

    const databaseId = `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const databaseName = name || `proj${projectId}_db`;

    await db.exec`
      INSERT INTO provisioned_databases (
        id, project_id, provider, region, name, status
      ) VALUES (
        ${databaseId}, ${projectId}, 'encore', ${region}, ${databaseName}, 'active'
      )
    `;

    const result = await db.queryRow<ProvisionedDatabase>`
      SELECT * FROM provisioned_databases WHERE id = ${databaseId}
    `;

    return result!;
  }
);


