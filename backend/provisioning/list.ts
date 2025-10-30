import { api } from "encore.dev/api";
import db from "../db";
import type { ProvisionedDatabase } from "./types";

interface ListDatabasesRequest {
  projectId?: number;
}

export const list = api(
  { method: "GET", path: "/provisioning/databases", expose: true },
  async (req: ListDatabasesRequest): Promise<{ databases: ProvisionedDatabase[] }> => {
    const { projectId } = req;

    let databases: ProvisionedDatabase[] = [];

    if (projectId) {
      const results = db.query<ProvisionedDatabase>`
        SELECT 
          id, project_id, provider, region, name, status,
          host, port, database_name, username,
          gcp_service_account_email,
          error_message, created_at, updated_at
        FROM provisioned_databases
        WHERE project_id = ${projectId}
        ORDER BY created_at DESC
      `;
      for await (const row of results) {
        databases.push(row);
      }
    } else {
      const results = db.query<ProvisionedDatabase>`
        SELECT 
          id, project_id, provider, region, name, status,
          host, port, database_name, username,
          gcp_service_account_email,
          error_message, created_at, updated_at
        FROM provisioned_databases
        ORDER BY created_at DESC
      `;
      for await (const row of results) {
        databases.push(row);
      }
    }

    return { databases };
  }
);
