import { api, APIError } from "encore.dev/api";
import db from "../db";
import { PROVIDERS } from "../config/providers";
import { neonApiKey, supabaseApiKey } from "../config/secrets";
import { NeonClient } from "./neon-client";
import { SupabaseClient } from "./supabase-client";

interface DeleteDatabaseRequest {
  id: string;
}

export const deleteDatabase = api(
  { method: "DELETE", path: "/provisioning/databases/:id", expose: true },
  async (req: DeleteDatabaseRequest): Promise<{ success: boolean }> => {
    const database = await db.queryRow<{
      id: string;
      provider: string;
      connection_string?: string;
    }>`
      SELECT id, provider, connection_string
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

    try {
      if (database.provider === "neon" && PROVIDERS.NEON && neonApiKey) {
        const neonClient = new NeonClient(neonApiKey());
        const projectId = extractNeonProjectId(database.connection_string);
        if (projectId) {
          await neonClient.deleteProject(projectId);
        }
      } else if (database.provider === "supabase" && PROVIDERS.SUPABASE && supabaseApiKey) {
        const supabaseClient = new SupabaseClient(supabaseApiKey());
        const projectRef = extractSupabaseProjectRef(database.connection_string);
        if (projectRef) {
          await supabaseClient.deleteProject(projectRef);
        }
      }

      await db.exec`
        UPDATE provisioned_databases
        SET status = 'deleted', updated_at = NOW()
        WHERE id = ${req.id}
      `;

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await db.exec`
        UPDATE provisioned_databases
        SET status = 'failed', error_message = ${errorMessage}, updated_at = NOW()
        WHERE id = ${req.id}
      `;
      throw APIError.internal(`Failed to delete database: ${errorMessage}`);
    }
  }
);

function extractNeonProjectId(connectionString?: string): string | null {
  if (!connectionString) return null;
  const match = connectionString.match(/([a-z0-9-]+)\.([a-z0-9-]+)\.neon\.tech/);
  return match ? match[2] : null;
}

function extractSupabaseProjectRef(connectionString?: string): string | null {
  if (!connectionString) return null;
  const match = connectionString.match(/db\.([a-z0-9]+)\.supabase\.co/);
  return match ? match[1] : null;
}
