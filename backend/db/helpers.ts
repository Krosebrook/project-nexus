import { APIError } from "encore.dev/api";
import db from "./index";

export async function validateProjectExists(projectId: number): Promise<void> {
  const result = await db.queryAll<{ exists: boolean }>`
    SELECT EXISTS(SELECT 1 FROM projects WHERE id = ${projectId})
  `;
  if (!result[0]?.exists) {
    throw APIError.notFound("project not found");
  }
}

export async function validateProjectName(name: string, excludeId?: number): Promise<void> {
  const result = excludeId
    ? await db.queryAll<{ exists: boolean }>`
        SELECT EXISTS(SELECT 1 FROM projects WHERE name = ${name} AND id != ${excludeId})
      `
    : await db.queryAll<{ exists: boolean }>`
        SELECT EXISTS(SELECT 1 FROM projects WHERE name = ${name})
      `;
  
  if (result[0]?.exists) {
    throw APIError.alreadyExists("project with this name already exists");
  }
}

export async function validateTestCaseExists(testId: number): Promise<void> {
  const result = await db.queryAll<{ exists: boolean }>`
    SELECT EXISTS(SELECT 1 FROM test_cases WHERE id = ${testId})
  `;
  if (!result[0]?.exists) {
    throw APIError.notFound("test case not found");
  }
}

export async function validateAlertRuleExists(alertId: number): Promise<void> {
  const result = await db.queryAll<{ exists: boolean }>`
    SELECT EXISTS(SELECT 1 FROM alert_rules WHERE id = ${alertId})
  `;
  if (!result[0]?.exists) {
    throw APIError.notFound("alert rule not found");
  }
}
