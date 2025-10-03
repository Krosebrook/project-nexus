import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { ErrorLog } from "./types";

interface ResolveRequest {
  error_id: number;
}

export const resolve = api(
  { method: "PATCH", path: "/errors/:error_id/resolve", expose: true },
  async (req: ResolveRequest): Promise<ErrorLog> => {
    const result = await db.queryRow<ErrorLog>`
      UPDATE error_logs
      SET is_resolved = true
      WHERE id = ${req.error_id}
      RETURNING *
    `;

    if (!result) {
      throw APIError.notFound("Error log not found");
    }

    return result;
  }
);