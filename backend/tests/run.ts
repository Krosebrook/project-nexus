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
    if (!actual_output || typeof actual_output !== "object") {
      throw APIError.invalidArgument("actual_output must be an object");
    }
    const actualOutputJson = JSON.stringify(actual_output);
    
    const test = await db.queryRow<TestCase>`
      WITH updated AS (
        UPDATE test_cases
        SET actual_output = ${actualOutputJson}::jsonb,
            last_run = NOW(),
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      )
      UPDATE test_cases tc
      SET status = CASE 
        WHEN tc.expected_output = tc.actual_output
        THEN 'passed'::text 
        ELSE 'failed'::text 
      END
      FROM updated u
      WHERE tc.id = u.id
      RETURNING tc.id, tc.project_id, tc.name, tc.input, tc.expected_output, tc.actual_output, tc.status, tc.last_run, tc.created_at, tc.updated_at
    `;
    if (!test) {
      throw APIError.notFound("test case not found");
    }
    return test;
  }
);
