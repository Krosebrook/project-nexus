import { api } from "encore.dev/api";
import db from "../db";
import type { TestCase } from "./types";

interface ListTestsParams {
  project_id: number;
}

interface ListTestsResponse {
  tests: TestCase[];
}

// Retrieves all test cases for a project.
export const list = api<ListTestsParams, ListTestsResponse>(
  { expose: true, method: "GET", path: "/tests/:project_id" },
  async ({ project_id }) => {
    const tests = await db.queryAll<TestCase>`
      SELECT id, project_id, name, input, expected_output, actual_output, status, last_run, created_at, updated_at
      FROM test_cases
      WHERE project_id = ${project_id}
      ORDER BY created_at DESC
    `;
    return { tests };
  }
);
