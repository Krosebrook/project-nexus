import { api } from "encore.dev/api";
import db from "../db";

export interface DeploymentTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  templateType: string;
  config: Record<string, any>;
  stages: Array<{ name: string; description: string }>;
  variables: Array<{
    name: string;
    description: string;
    required?: boolean;
    default?: string;
  }>;
  diagramData?: Record<string, any>;
  isBuiltIn: boolean;
  usageCount: number;
}

export interface ListTemplatesResponse {
  templates: DeploymentTemplate[];
}

export const listTemplates = api(
  { method: "GET", path: "/deployments/templates", expose: true },
  async (): Promise<ListTemplatesResponse> => {
    const templates = await db.queryAll<{
      id: number;
      name: string;
      description: string;
      category: string;
      template_type: string;
      config: string;
      stages: string;
      variables: string;
      diagram_data: string | null;
      is_built_in: boolean;
      usage_count: number;
    }>`
      SELECT 
        id,
        name,
        description,
        category,
        template_type,
        config::text,
        stages::text,
        variables::text,
        diagram_data::text,
        is_built_in,
        usage_count
      FROM deployment_templates
      ORDER BY category, usage_count DESC, name
    `;

    return {
      templates: templates.map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        templateType: t.template_type,
        config: JSON.parse(t.config),
        stages: JSON.parse(t.stages),
        variables: JSON.parse(t.variables),
        diagramData: t.diagram_data ? JSON.parse(t.diagram_data) : undefined,
        isBuiltIn: t.is_built_in,
        usageCount: t.usage_count,
      })),
    };
  }
);

export interface GetTemplateRequest {
  templateId: number;
}

export interface GetTemplateResponse {
  template: DeploymentTemplate;
}

export const getTemplate = api(
  { method: "GET", path: "/deployments/templates/:templateId", expose: true },
  async ({ templateId }: GetTemplateRequest): Promise<GetTemplateResponse> => {
    const template = await db.queryRow<{
      id: number;
      name: string;
      description: string;
      category: string;
      template_type: string;
      config: string;
      stages: string;
      variables: string;
      diagram_data: string | null;
      is_built_in: boolean;
      usage_count: number;
    }>`
      SELECT 
        id,
        name,
        description,
        category,
        template_type,
        config::text,
        stages::text,
        variables::text,
        diagram_data::text,
        is_built_in,
        usage_count
      FROM deployment_templates
      WHERE id = ${templateId}
    `;

    if (!template) {
      throw new Error("Template not found");
    }

    return {
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        templateType: template.template_type,
        config: JSON.parse(template.config),
        stages: JSON.parse(template.stages),
        variables: JSON.parse(template.variables),
        diagramData: template.diagram_data ? JSON.parse(template.diagram_data) : undefined,
        isBuiltIn: template.is_built_in,
        usageCount: template.usage_count,
      },
    };
  }
);

export interface CreateFromTemplateRequest {
  templateId: number;
  projectId: number;
  environment: string;
  variableValues: Record<string, string>;
}

export interface CreateFromTemplateResponse {
  deploymentId: number;
  config: Record<string, any>;
}

export const createFromTemplate = api(
  { method: "POST", path: "/deployments/from-template", expose: true },
  async (req: CreateFromTemplateRequest): Promise<CreateFromTemplateResponse> => {
    const template = await db.queryRow<{
      config: string;
      variables: string;
    }>`
      SELECT config::text, variables::text
      FROM deployment_templates
      WHERE id = ${req.templateId}
    `;

    if (!template) {
      throw new Error("Template not found");
    }

    const config = JSON.parse(template.config);
    const variables = JSON.parse(template.variables);

    for (const variable of variables) {
      if (variable.required && !req.variableValues[variable.name]) {
        throw new Error(`Missing required variable: ${variable.name}`);
      }
    }

    const result = await db.queryRow<{ id: bigint }>`
      INSERT INTO deployment_logs (
        project_id,
        environment,
        status,
        stage,
        progress,
        logs
      ) VALUES (
        ${req.projectId},
        ${req.environment},
        'pending',
        'template_init',
        0,
        'Created from template'
      )
      RETURNING id
    `;

    const deploymentId = Number(result!.id);

    await db.exec`
      INSERT INTO deployment_from_template (
        deployment_id,
        template_id,
        variable_values
      ) VALUES (
        ${deploymentId},
        ${req.templateId},
        ${JSON.stringify(req.variableValues)}
      )
    `;

    return {
      deploymentId,
      config: {
        ...config,
        variables: req.variableValues,
      },
    };
  }
);
