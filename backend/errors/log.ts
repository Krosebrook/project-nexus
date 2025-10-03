import { api } from "encore.dev/api";
import db from "../db";
import type { ErrorLog, LogErrorRequest } from "./types";
import { ErrorLogSchema, validateSchema } from "../shared/validation";

export const logError = api(
  { method: "POST", path: "/errors", expose: true },
  async (req: LogErrorRequest): Promise<ErrorLog> => {
    validateSchema(ErrorLogSchema, req);
    const result = await db.queryRow<ErrorLog>`
      INSERT INTO error_logs (
        session_id,
        user_id,
        error_type,
        error_message,
        error_stack,
        component_stack,
        url,
        user_agent,
        metadata,
        severity
      )
      VALUES (
        ${req.session_id || null},
        ${req.user_id || null},
        ${req.error_type},
        ${req.error_message},
        ${req.error_stack || null},
        ${req.component_stack || null},
        ${req.url || null},
        ${req.user_agent || null},
        ${JSON.stringify(req.metadata || {})}::jsonb,
        ${req.severity || "error"}
      )
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to log error");
    }

    return result;
  }
);