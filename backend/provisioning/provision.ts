import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import db from "../db";
import { NeonClient } from "./neon-client";
import { GCPIAMClient } from "./gcp-iam";
import { poolManager } from "./pool-manager";
import type { ProvisionDatabaseRequest, ProvisionedDatabase } from "./types";

const neonApiKey = secret("NeonAPIKey");
const gcpProjectId = secret("GCPProjectId");
const gcpServiceAccountKey = secret("GCPServiceAccountKey");

export const provision = api(
  { method: "POST", path: "/provisioning/databases", expose: true },
  async (req: ProvisionDatabaseRequest): Promise<ProvisionedDatabase> => {
    const { projectId, provider, region = "aws-us-east-2", name } = req;

    if (provider !== "neon") {
      throw APIError.unimplemented(`Provider ${provider} is not yet supported`);
    }

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
        ${databaseId}, ${projectId}, ${provider}, ${region}, ${databaseName}, 'provisioning'
      )
    `;

    provisionInBackground(databaseId, projectId, databaseName, region).catch((error) => {
      console.error(`Background provisioning failed for ${databaseId}:`, error);
    });

    const result = await db.queryRow<ProvisionedDatabase>`
      SELECT * FROM provisioned_databases WHERE id = ${databaseId}
    `;

    return result!;
  }
);

async function provisionInBackground(
  databaseId: string,
  projectId: number,
  databaseName: string,
  region: string
): Promise<void> {
  try {
    const neonClient = new NeonClient(neonApiKey());
    const neonProject = await neonClient.createProject(databaseName, region);

    const connectionUri = neonProject.connection_uris[0].connection_uri;
    const connectionConfig = neonClient.parseConnectionString(connectionUri);

    const serviceAccountKeyData = JSON.parse(gcpServiceAccountKey());
    const accessToken = await GCPIAMClient.getAccessTokenFromServiceAccount(serviceAccountKeyData);
    
    const gcpClient = new GCPIAMClient(accessToken, gcpProjectId());
    
    const serviceAccountId = `neon-${databaseId.replace(/_/g, "-")}`.substring(0, 30);
    const serviceAccountEmail = await gcpClient.createServiceAccount(
      serviceAccountId,
      `Neon DB ${databaseName}`
    );

    await gcpClient.grantDatabaseRole(serviceAccountEmail, "roles/cloudsql.client");

    const saKey = await gcpClient.createServiceAccountKey(serviceAccountEmail);

    await db.exec`
      UPDATE provisioned_databases
      SET 
        status = 'active',
        neon_project_id = ${neonProject.project.id},
        connection_string = ${connectionUri},
        host = ${connectionConfig.host},
        port = ${connectionConfig.port},
        database_name = ${connectionConfig.database},
        username = ${connectionConfig.username},
        password_encrypted = ${connectionConfig.password},
        gcp_service_account_email = ${serviceAccountEmail},
        gcp_service_account_key_encrypted = ${JSON.stringify(saKey)},
        updated_at = NOW()
      WHERE id = ${databaseId}
    `;

    const pool = poolManager.createPool(databaseId, connectionConfig);
    const connectionSuccess = await poolManager.testConnection(pool);

    await db.exec`
      INSERT INTO database_connection_logs (id, database_id, event_type, details)
      VALUES (
        ${`log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`},
        ${databaseId},
        ${connectionSuccess ? "connection_success" : "connection_failed"},
        ${JSON.stringify({ host: connectionConfig.host, port: connectionConfig.port })}
      )
    `;

  } catch (error: any) {
    console.error(`Provisioning failed for ${databaseId}:`, error);

    await db.exec`
      UPDATE provisioned_databases
      SET 
        status = 'failed',
        error_message = ${error.message},
        updated_at = NOW()
      WHERE id = ${databaseId}
    `;
  }
}
