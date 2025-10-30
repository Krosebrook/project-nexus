import { api, APIError } from "encore.dev/api";
import db from "../db";

interface ConnectionInfoRequest {
  id: string;
}

interface ConnectionInfo {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  connectionString: string;
  sslRequired: boolean;
}

export const getConnectionInfo = api(
  { method: "GET", path: "/provisioning/databases/:id/connection", expose: true },
  async (req: ConnectionInfoRequest): Promise<ConnectionInfo> => {
    const database = await db.queryRow<{
      status: string;
      host: string;
      port: number;
      database_name: string;
      username: string;
      password_encrypted: string;
      connection_string: string;
    }>`
      SELECT 
        status, host, port, database_name, username,
        password_encrypted, connection_string
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
      host: database.host,
      port: database.port,
      database: database.database_name,
      username: database.username,
      password: database.password_encrypted,
      connectionString: database.connection_string,
      sslRequired: true,
    };
  }
);
