import { api } from "encore.dev/api";
import db from "../db";
import type { TestCoverage } from "./types";

interface RecordCoverageRequest {
  project_id: number;
  deployment_id?: number;
  total_lines: number;
  covered_lines: number;
  file_coverage?: Record<string, any>;
}

export const recordCoverage = api(
  { method: "POST", path: "/coverage", expose: true },
  async (req: RecordCoverageRequest): Promise<TestCoverage> => {

    
    const coveragePercentage = (req.covered_lines / req.total_lines) * 100;
    
    const coverage = await db.queryRow<TestCoverage>`
      INSERT INTO test_coverage (
        project_id,
        deployment_id,
        total_lines,
        covered_lines,
        coverage_percentage,
        file_coverage
      ) VALUES (
        ${req.project_id},
        ${req.deployment_id || null},
        ${req.total_lines},
        ${req.covered_lines},
        ${coveragePercentage},
        ${JSON.stringify(req.file_coverage || {})}
      )
      RETURNING *
    `;
    
    if (!coverage) {
      throw new Error("Failed to record coverage");
    }
    
    return coverage;
  }
);

interface GetCoverageResponse {
  coverage: TestCoverage[];
}

export const getCoverage = api(
  { method: "GET", path: "/coverage/:projectId", expose: true },
  async ({ projectId, limit = 30 }: { projectId: number; limit?: number }): Promise<GetCoverageResponse> => {

    
    const coverage = await db.queryAll<TestCoverage>`
      SELECT * FROM test_coverage 
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    
    return { coverage };
  }
);

export const getCoverageTrend = api(
  { method: "GET", path: "/coverage/:projectId/trend", expose: true },
  async ({ projectId }: { projectId: number }): Promise<{ trend: number; latest: number; previous: number }> => {

    
    const recent = await db.queryAll<TestCoverage>`
      SELECT coverage_percentage FROM test_coverage 
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT 2
    `;
    
    if (recent.length === 0) {
      return { trend: 0, latest: 0, previous: 0 };
    }
    
    const latest = recent[0].coverage_percentage;
    const previous = recent.length > 1 ? recent[1].coverage_percentage : latest;
    const trend = latest - previous;
    
    return { trend, latest, previous };
  }
);