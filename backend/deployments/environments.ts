import { api } from "encore.dev/api";
import db from "../db";
import type { Environment, EnvironmentType } from "./types";

interface CreateEnvironmentRequest {
  project_id: number;
  name: string;
  type: EnvironmentType;
  url?: string;
  config?: Record<string, any>;
}

interface UpdateEnvironmentRequest {
  id: number;
  url?: string;
  config?: Record<string, any>;
  is_active?: boolean;
}

export const createEnvironment = api(
  { method: "POST", path: "/environments", expose: true },
  async (req: CreateEnvironmentRequest): Promise<Environment> => {

    
    const env = await db.queryRow<Environment>`
      INSERT INTO environments (
        project_id,
        name,
        type,
        url,
        config
      ) VALUES (
        ${req.project_id},
        ${req.name},
        ${req.type},
        ${req.url || null},
        ${JSON.stringify(req.config || {})}
      )
      RETURNING *
    `;
    
    if (!env) {
      throw new Error("Failed to create environment");
    }
    
    return env;
  }
);

interface ListEnvironmentsResponse {
  environments: Environment[];
}

export const listEnvironments = api(
  { method: "GET", path: "/environments/project/:projectId", expose: true },
  async ({ projectId }: { projectId: number }): Promise<ListEnvironmentsResponse> => {

    
    const envs = await db.queryAll<Environment>`
      SELECT * FROM environments 
      WHERE project_id = ${projectId}
      ORDER BY 
        CASE type
          WHEN 'development' THEN 1
          WHEN 'staging' THEN 2
          WHEN 'production' THEN 3
        END
    `;
    
    return { environments: envs };
  }
);

export const updateEnvironment = api(
  { method: "PUT", path: "/environments/:id", expose: true },
  async ({ id, url, config, is_active }: UpdateEnvironmentRequest): Promise<Environment> => {

    
    if (url === undefined && config === undefined && is_active === undefined) {
      throw new Error("No fields to update");
    }
    
    let env: Environment | null = null;
    
    if (url !== undefined && config !== undefined && is_active !== undefined) {
      env = await db.queryRow<Environment>`
        UPDATE environments 
        SET url = ${url}, config = ${JSON.stringify(config)}, is_active = ${is_active}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (url !== undefined && config !== undefined) {
      env = await db.queryRow<Environment>`
        UPDATE environments 
        SET url = ${url}, config = ${JSON.stringify(config)}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (url !== undefined && is_active !== undefined) {
      env = await db.queryRow<Environment>`
        UPDATE environments 
        SET url = ${url}, is_active = ${is_active}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (config !== undefined && is_active !== undefined) {
      env = await db.queryRow<Environment>`
        UPDATE environments 
        SET config = ${JSON.stringify(config)}, is_active = ${is_active}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (url !== undefined) {
      env = await db.queryRow<Environment>`
        UPDATE environments 
        SET url = ${url}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (config !== undefined) {
      env = await db.queryRow<Environment>`
        UPDATE environments 
        SET config = ${JSON.stringify(config)}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (is_active !== undefined) {
      env = await db.queryRow<Environment>`
        UPDATE environments 
        SET is_active = ${is_active}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
    }
    
    if (!env) {
      throw new Error("Environment not found");
    }
    
    return env;
  }
);