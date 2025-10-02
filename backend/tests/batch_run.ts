import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { TestCase } from "./types";

export interface BatchRunRequest {
  project_id: number;
  test_ids?: number[];
}

export interface BatchRunResponse {
  executed: number;
  passed: number;
  failed: number;
  results: TestCase[];
}

export const batchRun = api<BatchRunRequest, BatchRunResponse>(
  { method: "POST", path: "/tests/batch-run", expose: true },
  async (req) => {
    let tests: TestCase[];

    if (req.test_ids && req.test_ids.length > 0) {
      tests = await db.queryAll<TestCase>`
        SELECT * FROM test_cases 
        WHERE project_id = ${req.project_id} AND id = ANY(${req.test_ids})
      `;
    } else {
      tests = await db.queryAll<TestCase>`
        SELECT * FROM test_cases WHERE project_id = ${req.project_id}
      `;
    }

    if (tests.length === 0) {
      throw APIError.notFound("no tests found");
    }

    const results: TestCase[] = [];
    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      const actualOutput = { simulated: true, result: Math.random() > 0.5 };
      const status = JSON.stringify(actualOutput) === JSON.stringify(test.expected_output) ? "passed" : "failed";
      
      if (status === "passed") passed++;
      else failed++;

      const updated = await db.queryRow<TestCase>`
        UPDATE test_cases 
        SET actual_output = ${actualOutput}, status = ${status}, last_run = NOW(), updated_at = NOW()
        WHERE id = ${test.id}
        RETURNING *
      `;

      if (updated) results.push(updated);
    }

    return {
      executed: results.length,
      passed,
      failed,
      results
    };
  }
);
