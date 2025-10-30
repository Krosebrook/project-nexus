import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import db from "../db";
import { NeonClient } from "./neon-client";
import { GCPIAMClient } from "./gcp-iam";
import { poolManager } from "./pool-manager";

const neonApiKey = secret("NeonAPIKey");
const gcpProjectId = secret("GCPProjectId");
const gcpServiceAccountKey = secret("GCPServiceAccountKey");

interface DeleteDatabaseRequest {
  id: string;
}

export const deleteDatabase = api(
  { method: "DELETE", path: "/provisioning/databases/:id", expose: true },
  async (req: DeleteDatabaseRequest): Promise<{ success: boolean }> => {
    const database = await db.queryRow<{
      id: string;
      neon_project_id: string | null;
      gcp_service_account_email: string | null;
    }>`
      SELECT id, neon_project_id, gcp_service_account_email
      FROM provisioned_databases
      WHERE id = ${req.id}
    `;

    if (!database) {
      throw APIError.notFound("Database not found");
    }

    await db.exec`
      UPDATE provisioned_databases
      SET status = 'deleting', updated_at = NOW()
      WHERE id = ${req.id}
    `;

    deleteInBackground(
      req.id,
      database.neon_project_id,
      database.gcp_service_account_email
    ).catch((error) => {
      console.error(`Background deletion failed for ${req.id}:`, error);
    });

    return { success: true };
  }
);

async function deleteInBackground(
  databaseId: string,
  neonProjectId: string | null,
  gcpServiceAccountEmail: string | null
): Promise<void> {
  try {
    await poolManager.closePool(databaseId);

    if (neonProjectId) {
      const neonClient = new NeonClient(neonApiKey());
      await neonClient.deleteProject(neonProjectId);
    }

    if (gcpServiceAccountEmail) {
      const serviceAccountKeyData = JSON.parse(gcpServiceAccountKey());
      const accessToken = await GCPIAMClient.getAccessTokenFromServiceAccount(serviceAccountKeyData);
      const gcpClient = new GCPIAMClient(accessToken, gcpProjectId());
      await gcpClient.deleteServiceAccount(gcpServiceAccountEmail);
    }

    await db.exec`
      UPDATE provisioned_databases
      SET status = 'deleted', updated_at = NOW()
      WHERE id = ${databaseId}
    `;

  } catch (error: any) {
    console.error(`Deletion failed for ${databaseId}:`, error);

    await db.exec`
      UPDATE provisioned_databases
      SET 
        status = 'failed',
        error_message = ${`Deletion failed: ${error.message}`},
        updated_at = NOW()
      WHERE id = ${databaseId}
    `;
  }
}
