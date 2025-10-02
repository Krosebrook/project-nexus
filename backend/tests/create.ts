import { api, APIError } from "encore.dev/api";
import db from "../db";
import { validateProjectExists } from "../db/helpers";
import type { TestCase } from "./types";

export interface CreateTestCaseRequest {
  project_id: number;
  name: string;
  input: Record<string, any>;
  expected_output: Record<string, any>;
}

export const create = api<CreateTestCaseRequest, TestCase>(
  { method: "POST", path: "/tests", expose: true },
  async (req) => {
    if (!req.name?.trim()) {
      throw APIError.invalidArgument("name is required");
    }
    if (!req.input || typeof req.input !== "object") {
      throw APIError.invalidArgument("input must be an object");
    }
    if (!req.expected_output || typeof req.expected_output !== "object") {
      throw APIError.invalidArgument("expected_output must be an object");
    }

    await validateProjectExists(req.project_id);

    const result = await db.queryRow<TestCase>`
      INSERT INTO test_cases (project_id, name, input, expected_output)
      VALUES (${req.project_id}, ${req.name}, ${req.input}, ${req.expected_output})
      RETURNING *
    `;

    return result!;
  }
);
