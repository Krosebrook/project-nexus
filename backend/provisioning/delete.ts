import { api, APIError } from "encore.dev/api";
import db from "../db";

interface DeleteDatabaseRequest {
  id: string;
}

export const deleteDatabase = api(
  { method: "DELETE", path: "/provisioning/databases/:id", expose: true },
  async (req: DeleteDatabaseRequest): Promise<{ success: boolean }> => {
    const database = await db.queryRow<{
      id: string;
    }>`
      SELECT id
      FROM provisioned_databases
      WHERE id = ${req.id}
    `;

    if (!database) {
      throw APIError.notFound("Database not found");
    }

    await db.exec`
      UPDATE provisioned_databases
      SET status = 'deleted', updated_at = NOW()
      WHERE id = ${req.id}
    `;

    return { success: true };
  }
);


