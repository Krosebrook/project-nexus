import { APIError } from "encore.dev/api";
import db from "./index";

export async function validateEntityExists(
  table: string,
  id: number,
  entityName: string = "entity"
): Promise<void> {
  const query = `SELECT EXISTS(SELECT 1 FROM ${table} WHERE id = $1)`;
  const result = await db.rawQueryAll(query, id);
  if (!result[0]?.exists) {
    throw APIError.notFound(`${entityName} not found`);
  }
}

export async function validateUniqueName(
  table: string,
  name: string,
  errorMessage: string = "entity with this name already exists",
  excludeId?: number
): Promise<void> {
  let query: string;
  let params: any[];
  
  if (excludeId) {
    query = `SELECT EXISTS(SELECT 1 FROM ${table} WHERE name = $1 AND id != $2)`;
    params = [name, excludeId];
  } else {
    query = `SELECT EXISTS(SELECT 1 FROM ${table} WHERE name = $1)`;
    params = [name];
  }
  
  const result = await db.rawQueryAll(query, ...params);
  
  if (result[0]?.exists) {
    throw APIError.alreadyExists(errorMessage);
  }
}

export async function validateProjectExists(projectId: number): Promise<void> {
  await validateEntityExists("projects", projectId, "project");
}

export async function validateProjectName(name: string, excludeId?: number): Promise<void> {
  await validateUniqueName("projects", name, "project with this name already exists", excludeId);
}

export async function validateTestCaseExists(testId: number): Promise<void> {
  await validateEntityExists("test_cases", testId, "test case");
}

export async function validateAlertRuleExists(alertId: number): Promise<void> {
  await validateEntityExists("alert_rules", alertId, "alert rule");
}
