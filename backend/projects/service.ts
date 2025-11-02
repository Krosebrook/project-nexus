import db from "../db";
import { repositories } from "../db/repository";
import { validateString, validateEnum, validateRange } from "../shared/validation";
import type { Project, ProjectStatus } from "./types";

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  health_score?: number;
  metrics?: Record<string, any>;
}

class ProjectService {
  private repo = repositories.projects;

  async list(): Promise<Project[]> {
    return db.queryAll<Project>`
      SELECT id, name, description, status, health_score, last_activity, metrics, created_at, updated_at
      FROM projects
      ORDER BY last_activity DESC
    `;
  }

  async getById(id: number): Promise<Project> {
    const project = await db.queryRow<Project>`
      SELECT id, name, description, status, health_score, last_activity, metrics, created_at, updated_at
      FROM projects
      WHERE id = ${id}
    `;
    return await this.repo.findByIdOrThrow(id);
  }

  async create(input: CreateProjectInput): Promise<Project> {
    validateString(input.name, "name");
    
    const status = input.status || "active";
    validateEnum(status, ["active", "development", "maintenance", "archived"] as const, "status");

    await this.repo.validateUniqueName(input.name);

    const result = await db.queryRow<Project>`
      INSERT INTO projects (name, description, status)
      VALUES (${input.name}, ${input.description || null}, ${status})
      RETURNING *
    `;

    return result!;
  }

  async update(id: number, input: UpdateProjectInput): Promise<Project> {
    await this.repo.exists(id);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      validateString(input.name, "name");
      await this.repo.validateUniqueName(input.name, id);
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }

    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }

    if (input.status !== undefined) {
      validateEnum(input.status, ["active", "development", "maintenance", "archived"] as const, "status");
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }

    if (input.health_score !== undefined) {
      validateRange(input.health_score, 0, 100, "health_score");
      updates.push(`health_score = $${paramIndex++}`);
      values.push(input.health_score);
    }

    if (input.metrics !== undefined) {
      updates.push(`metrics = $${paramIndex++}`);
      values.push(JSON.stringify(input.metrics));
    }

    if (updates.length === 0) {
      throw new Error("no fields to update");
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`last_activity = NOW()`);
    values.push(id);

    const query = `
      UPDATE projects
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, name, description, status, health_score, last_activity, metrics, created_at, updated_at
    `;

    const project = await db.rawQueryRow<Project>(query, ...values);
    return project!;
  }

  async delete(id: number): Promise<void> {
    await this.repo.deleteById(id);
  }

  async getMetrics(id: number): Promise<Record<string, any>> {
    const project = await this.getById(id);
    return project.metrics || {};
  }
}

export const projectService = new ProjectService();
