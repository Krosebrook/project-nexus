import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { ProvisionedDatabase } from "./types";

interface GetDatabaseRequest {
  id: string;
}

export const get = api(
  { method: "GET", path: "/provisioning/databases/:id", expose: true },
  async (req: GetDatabaseRequest): Promise<ProvisionedDatabase> => {
    const database = await db.queryRow<ProvisionedDatabase>`
      SELECT 
        id, project_id, provider, region, name, status,
        host, port, database_name, username,
        gcp_service_account_email,
        error_message, created_at, updated_at
      FROM provisioned_databases
      WHERE id = ${req.id}
    `;

    if (!database) {
      throw APIError.notFound("Database not found");
    }

    return database;
  }
);
