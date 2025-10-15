import { api } from "encore.dev/api";
import db from "../db";

interface DeleteRequest {
  widget_id: number;
}

export const deleteWidget = api(
  { method: "DELETE", path: "/widgets/:widget_id", expose: true },
  async (req: DeleteRequest): Promise<void> => {
    await db.exec`
      DELETE FROM dashboard_widgets WHERE id = ${req.widget_id}
    `;
  }
);