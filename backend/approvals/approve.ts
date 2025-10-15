import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { DeploymentApproval, ApproveRequest } from "./types";

export const approve = api(
  { method: "POST", path: "/approvals/:approval_id/approve", expose: true },
  async (req: ApproveRequest): Promise<DeploymentApproval> => {
    const approval = await db.queryRow<DeploymentApproval>`
      SELECT * FROM deployment_approvals WHERE id = ${req.approval_id}
    `;

    if (!approval) {
      throw APIError.notFound("Approval not found");
    }

    if (approval.status !== "pending") {
      throw APIError.invalidArgument(`Approval already ${approval.status}`);
    }

    if (approval.approved_by.includes(req.user_id)) {
      throw APIError.invalidArgument("User has already approved");
    }

    const tx = await db.begin();
    
    try {
      await tx.exec`
        INSERT INTO approval_actions (approval_id, user_id, action, comment)
        VALUES (${req.approval_id}, ${req.user_id}, 'approve', ${req.comment || null})
      `;

      const approvedBy = [...approval.approved_by, req.user_id];
      const approvalCount = approvedBy.length;
      const newStatus = approvalCount >= approval.required_approvals ? "approved" : "pending";

      const updated = await tx.queryRow<DeploymentApproval>`
        UPDATE deployment_approvals
        SET 
          approved_by = ${approvedBy}::BIGINT[],
          approval_count = ${approvalCount},
          status = ${newStatus},
          updated_at = NOW()
        WHERE id = ${req.approval_id}
        RETURNING *
      `;

      if (!updated) {
        throw new Error("Failed to update approval");
      }

      if (newStatus === "approved") {
        await tx.exec`
          UPDATE deployments
          SET status = 'approved'
          WHERE id = ${approval.deployment_id}
        `;
      }

      await tx.commit();
      
      return updated;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }
);