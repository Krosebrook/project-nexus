import { api } from "encore.dev/api";
import db from "../db";
import type { DeploymentComparison, DeploymentLog } from "./types";

interface CompareRequest {
  deployment_a_id: number;
  deployment_b_id: number;
}

export const compare = api(
  { method: "POST", path: "/deployments/compare", expose: true },
  async (req: CompareRequest): Promise<DeploymentComparison> => {

    
    const [deploymentA, deploymentB] = await Promise.all([
      db.queryRow<DeploymentLog>`SELECT * FROM deployment_logs WHERE id = ${req.deployment_a_id}`,
      db.queryRow<DeploymentLog>`SELECT * FROM deployment_logs WHERE id = ${req.deployment_b_id}`
    ]);
    
    if (!deploymentA || !deploymentB) {
      throw new Error("One or both deployments not found");
    }
    
    if (deploymentA.project_id !== deploymentB.project_id) {
      throw new Error("Cannot compare deployments from different projects");
    }
    
    const diffSummary = {
      status_change: {
        from: deploymentA.status,
        to: deploymentB.status
      },
      time_difference_ms: deploymentB.created_at.getTime() - deploymentA.created_at.getTime(),
      metadata_diff: computeMetadataDiff(deploymentA.metadata || {}, deploymentB.metadata || {}),
      stage_progression: {
        from: deploymentA.stage,
        to: deploymentB.stage
      },
      error_introduced: !deploymentA.error_message && deploymentB.error_message,
      error_resolved: deploymentA.error_message && !deploymentB.error_message
    };
    
    const comparison = await db.queryRow<DeploymentComparison>`
      INSERT INTO deployment_comparisons (
        project_id,
        deployment_a_id,
        deployment_b_id,
        diff_summary
      ) VALUES (
        ${deploymentA.project_id},
        ${req.deployment_a_id},
        ${req.deployment_b_id},
        ${JSON.stringify(diffSummary)}
      )
      RETURNING *
    `;
    
    if (!comparison) {
      throw new Error("Failed to create comparison");
    }
    
    return comparison;
  }
);

function computeMetadataDiff(a: Record<string, any>, b: Record<string, any>): Record<string, any> {
  const diff: Record<string, any> = {};
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  
  for (const key of allKeys) {
    if (!(key in a)) {
      diff[key] = { added: b[key] };
    } else if (!(key in b)) {
      diff[key] = { removed: a[key] };
    } else if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      diff[key] = { from: a[key], to: b[key] };
    }
  }
  
  return diff;
}

interface ListComparisonsResponse {
  comparisons: DeploymentComparison[];
}

export const listComparisons = api(
  { method: "GET", path: "/deployments/:projectId/comparisons", expose: true },
  async ({ projectId }: { projectId: number }): Promise<ListComparisonsResponse> => {

    
    const comparisons = await db.queryAll<DeploymentComparison>`
      SELECT * FROM deployment_comparisons 
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    
    return { comparisons };
  }
);