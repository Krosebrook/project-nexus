import { api, APIError } from "encore.dev/api";
import db from "../db";

interface ConnectionInfoRequest {
  id: string;
}

interface ConnectionInfo {
  provider: string;
  host: string;
  port: number;
  database: string;
  username: string;
  connectionString?: string;
  sslRequired: boolean;
  status: string;
}

export const getConnectionInfo = api(
  { method: "GET", path: "/provisioning/databases/:id/connection", expose: true },
  async (req: ConnectionInfoRequest): Promise<ConnectionInfo> => {
    const database = await db.queryRow<{
      provider: string;
      status: string;
      host?: string;
      port?: number;
      database?: string;
      username?: string;
      connection_string?: string;
    }>`
      SELECT 
        provider, status, host, port, database, username, connection_string
      FROM provisioned_databases
      WHERE id = ${req.id}
    `;

    if (!database) {
      throw APIError.notFound("Database not found");
    }

    if (database.status !== "active") {
      throw APIError.unavailable(`Database is ${database.status}`);
    }

    return {
      provider: database.provider,
      host: database.host || "",
      port: database.port || 5432,
      database: database.database || "",
      username: database.username || "",
      connectionString: database.connection_string,
      sslRequired: true,
      status: database.status,
    };
  }
);
