import { api } from "encore.dev/api";
import db from "../db";

export interface DeploymentTemplate {
  id: number;
  name: string;
  description: string | null;
  template_type: string;
  stages: string[];
  stage_config: Record<string, any>;
  environment_config: Record<string, any>;
  required_approvals: number;
  auto_rollback_on_failure: boolean;
  health_check_config: Record<string, any>;
  notification_config: Record<string, any>;
  is_public: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ListTemplatesResponse {
  templates: DeploymentTemplate[];
}

export const listTemplates = api(
  { method: "GET", path: "/deployments/templates", expose: true },
  async (): Promise<ListTemplatesResponse> => {
    const templates = await db.query<DeploymentTemplate>`
      SELECT * FROM deployment_templates
      WHERE is_public = true
      ORDER BY name ASC
    `;

    return { templates };
  }
);

export interface GetTemplateRequest {
  id: number;
}

export const getTemplate = api(
  { method: "GET", path: "/deployments/templates/:id", expose: true },
  async ({ id }: GetTemplateRequest): Promise<DeploymentTemplate> => {
    const template = await db.queryRow<DeploymentTemplate>`
      SELECT * FROM deployment_templates WHERE id = ${id}
    `;

    if (!template) {
      throw new Error("Template not found");
    }

    return template;
  }
);

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  template_type: string;
  stages: string[];
  stage_config: Record<string, any>;
  environment_config?: Record<string, any>;
  required_approvals?: number;
  auto_rollback_on_failure?: boolean;
  health_check_config?: Record<string, any>;
  notification_config?: Record<string, any>;
  is_public?: boolean;
  created_by?: string;
}

export const createTemplate = api(
  { method: "POST", path: "/deployments/templates", expose: true },
  async (req: CreateTemplateRequest): Promise<DeploymentTemplate> => {
    const template = await db.queryRow<DeploymentTemplate>`
      INSERT INTO deployment_templates (
        name,
        description,
        template_type,
        stages,
        stage_config,
        environment_config,
        required_approvals,
        auto_rollback_on_failure,
        health_check_config,
        notification_config,
        is_public,
        created_by
      ) VALUES (
        ${req.name},
        ${req.description || null},
        ${req.template_type},
        ${JSON.stringify(req.stages)},
        ${JSON.stringify(req.stage_config)},
        ${JSON.stringify(req.environment_config || {})},
        ${req.required_approvals || 0},
        ${req.auto_rollback_on_failure || false},
        ${JSON.stringify(req.health_check_config || {})},
        ${JSON.stringify(req.notification_config || {})},
        ${req.is_public !== undefined ? req.is_public : true},
        ${req.created_by || null}
      )
      RETURNING *
    `;

    if (!template) {
      throw new Error("Failed to create template");
    }

    return template;
  }
);

export interface AssignTemplateRequest {
  project_id: number;
  template_id: number;
  is_default?: boolean;
  override_config?: Record<string, any>;
}

export interface ProjectTemplate {
  id: number;
  project_id: number;
  template_id: number;
  is_default: boolean;
  override_config: Record<string, any>;
  created_at: Date;
  template: DeploymentTemplate;
}

export const assignTemplate = api(
  { method: "POST", path: "/deployments/templates/assign", expose: true },
  async (req: AssignTemplateRequest): Promise<ProjectTemplate> => {
    if (req.is_default) {
      await db.exec`
        UPDATE project_deployment_templates
        SET is_default = false
        WHERE project_id = ${req.project_id}
      `;
    }

    const assignment = await db.queryRow<{
      id: number;
      project_id: number;
      template_id: number;
      is_default: boolean;
      override_config: Record<string, any>;
      created_at: Date;
    }>`
      INSERT INTO project_deployment_templates (
        project_id,
        template_id,
        is_default,
        override_config
      ) VALUES (
        ${req.project_id},
        ${req.template_id},
        ${req.is_default || false},
        ${JSON.stringify(req.override_config || {})}
      )
      ON CONFLICT (project_id, template_id)
      DO UPDATE SET
        is_default = EXCLUDED.is_default,
        override_config = EXCLUDED.override_config
      RETURNING *
    `;

    if (!assignment) {
      throw new Error("Failed to assign template");
    }

    const template = await db.queryRow<DeploymentTemplate>`
      SELECT * FROM deployment_templates WHERE id = ${req.template_id}
    `;

    if (!template) {
      throw new Error("Template not found");
    }

    return {
      ...assignment,
      template,
    };
  }
);

export interface ListProjectTemplatesRequest {
  project_id: number;
}

export interface ListProjectTemplatesResponse {
  templates: ProjectTemplate[];
}

export const listProjectTemplates = api(
  { method: "GET", path: "/projects/:project_id/templates", expose: true },
  async ({ project_id }: ListProjectTemplatesRequest): Promise<ListProjectTemplatesResponse> => {
    const assignments = await db.query<{
      id: number;
      project_id: number;
      template_id: number;
      is_default: boolean;
      override_config: Record<string, any>;
      created_at: Date;
    }>`
      SELECT * FROM project_deployment_templates
      WHERE project_id = ${project_id}
      ORDER BY is_default DESC, created_at DESC
    `;

    const templates: ProjectTemplate[] = [];

    for (const assignment of assignments) {
      const template = await db.queryRow<DeploymentTemplate>`
        SELECT * FROM deployment_templates WHERE id = ${assignment.template_id}
      `;

      if (template) {
        templates.push({
          ...assignment,
          template,
        });
      }
    }

    return { templates };
  }
);