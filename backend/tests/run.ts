import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { TestCase } from "./types";

interface RunTestParams {
  id: number;
}

interface RunTestRequest {
  actual_output: Record<string, any>;
}

// Updates test results after running a test case.
export const run = api<RunTestRequest & RunTestParams, TestCase>(
  { expose: true, method: "POST", path: "/tests/:id/run" },
  async ({ id, actual_output }) => {
    const test = await db.queryRow<TestCase>`
      UPDATE test_cases
      SET actual_output = ${JSON.stringify(actual_output)},
          status = CASE 
            WHEN ${JSON.stringify(actual_output)} = expected_output::text::jsonb 
            THEN 'passed'::text 
            ELSE 'failed'::text 
          END,
          last_run = NOW(),
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, project_id, name, input, expected_output, actual_output, status, last_run, created_at, updated_at
    `;
    if (!test) {
      throw APIError.notFound("test case not found");
    }
    return test;
  }
);
