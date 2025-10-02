import { api, APIError } from "encore.dev/api";
import db from "../db";

export interface DeleteTestCaseRequest {
  id: number;
}

export interface DeleteTestCaseResponse {
  success: boolean;
}

export const deleteTest = api<DeleteTestCaseRequest, DeleteTestCaseResponse>(
  { method: "DELETE", path: "/tests/:id", expose: true },
  async (req) => {
    const result = await db.queryRow<{ id: number }>`
      DELETE FROM test_cases WHERE id = ${req.id} RETURNING id
    `;

    if (!result) {
      throw APIError.notFound("test case not found");
    }

    return { success: true };
  }
);
