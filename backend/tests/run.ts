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
    
    const test = await db.queryRow<TestCase>`
      UPDATE test_cases
      SET actual_output = ${actual_output},
          last_run = NOW(),
          updated_at = NOW(),
          status = CASE 
            WHEN expected_output = ${actual_output}
            THEN 'passed'::text 
            ELSE 'failed'::text 
          END
      WHERE id = ${id}
      RETURNING id, project_id, name, input, expected_output, actual_output, status, last_run, created_at, updated_at
    `;
    if (!test) {
      throw APIError.notFound("test case not found");
    }
    return test;
  }
);
