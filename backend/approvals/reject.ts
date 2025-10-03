import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { DeploymentApproval, RejectRequest } from "./types";

export const reject = api(
  { method: "POST", path: "/approvals/:approval_id/reject", expose: true },
  async (req: RejectRequest): Promise<DeploymentApproval> => {
    const approval = await db.queryRow<DeploymentApproval>`
      SELECT * FROM deployment_approvals WHERE id = ${req.approval_id}
    `;

    if (!approval) {
      throw APIError.notFound("Approval not found");
    }

    if (approval.status !== "pending") {
      throw APIError.invalidArgument(`Approval already ${approval.status}`);
    }

    const tx = await db.begin();
    
    try {
      await tx.exec`
        INSERT INTO approval_actions (approval_id, user_id, action, comment)
        VALUES (${req.approval_id}, ${req.user_id}, 'reject', ${req.reason})
      `;

      const updated = await tx.queryRow<DeploymentApproval>`
        UPDATE deployment_approvals
        SET 
          status = 'rejected',
          rejected_by = ${req.user_id},
          rejection_reason = ${req.reason},
          updated_at = NOW()
        WHERE id = ${req.approval_id}
        RETURNING *
      `;

      if (!updated) {
        throw new Error("Failed to update approval");
      }

      await tx.exec`
        UPDATE deployments
        SET status = 'rejected'
        WHERE id = ${approval.deployment_id}
      `;

      await tx.commit();
      
      return updated;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }
);