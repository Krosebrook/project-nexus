import { api, APIError } from "encore.dev/api";
import db from "../db";
import { PROVIDERS } from "../config/providers";
import { neonApiKey, supabaseApiKey, supabaseOrgId, gcpProjectId, gcpSaKey } from "../config/secrets";
import { NeonClient } from "./neon-client";
import { SupabaseClient } from "./supabase-client";
import type { ProvisionDatabaseRequest, ProvisionedDatabase, NeonProjectResponse, SupabaseProjectResponse } from "./types";

export const provision = api(
  { method: "POST", path: "/provisioning/databases", expose: true },
  async (req: ProvisionDatabaseRequest): Promise<ProvisionedDatabase> => {
    const { projectId, provider, region, name } = req;

    const projectCheck = await db.queryRow`
      SELECT id FROM projects WHERE id = ${projectId}
    `;

    if (!projectCheck) {
      throw APIError.notFound("Project not found");
    }

    const databaseId = `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const databaseName = name || `proj${projectId}_db`;

    if (provider === "neon") {
      return await provisionNeon(databaseId, projectId, databaseName, region || "aws-us-east-2");
    } else if (provider === "supabase") {
      return await provisionSupabase(databaseId, projectId, databaseName, region || "us-east-1");
    } else {
      await db.exec`
        INSERT INTO provisioned_databases (
          id, project_id, provider, region, name, status
        ) VALUES (
          ${databaseId}, ${projectId}, ${provider}, ${region || "default"}, ${databaseName}, 'active'
        )
      `;

      const result = await db.queryRow<ProvisionedDatabase>`
        SELECT * FROM provisioned_databases WHERE id = ${databaseId}
      `;

      return result!;
    }
  }
);

async function provisionNeon(
  databaseId: string,
  projectId: number,
  databaseName: string,
  region: string
): Promise<ProvisionedDatabase> {
  if (!PROVIDERS.NEON || !neonApiKey) {
    throw APIError.failedPrecondition("Neon provider is not configured");
  }

  const neonClient = new NeonClient(neonApiKey());

  await db.exec`
    INSERT INTO provisioned_databases (
      id, project_id, provider, region, name, status
    ) VALUES (
      ${databaseId}, ${projectId}, 'neon', ${region}, ${databaseName}, 'provisioning'
    )
  `;

  try {
    const neonProject: NeonProjectResponse = await neonClient.createProject(databaseName, region);

    const connectionUri = neonProject.connection_uris[0]?.connection_uri;
    const params = neonProject.connection_uris[0]?.connection_parameters;

    if (!connectionUri || !params) {
      throw new Error("Invalid Neon project response");
    }

    await db.exec`
      UPDATE provisioned_databases
      SET
        status = 'active',
        connection_string = ${connectionUri},
        host = ${params.host},
        port = ${params.port},
        database = ${params.database},
        username = ${params.role},
        updated_at = NOW()
      WHERE id = ${databaseId}
    `;

    const result = await db.queryRow<ProvisionedDatabase>`
      SELECT * FROM provisioned_databases WHERE id = ${databaseId}
    `;

    return result!;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await db.exec`
      UPDATE provisioned_databases
      SET status = 'failed', error_message = ${errorMessage}, updated_at = NOW()
      WHERE id = ${databaseId}
    `;
    throw APIError.internal(`Failed to provision Neon database: ${errorMessage}`);
  }
}

async function provisionSupabase(
  databaseId: string,
  projectId: number,
  databaseName: string,
  region: string
): Promise<ProvisionedDatabase> {
  if (!PROVIDERS.SUPABASE || !supabaseApiKey || !supabaseOrgId) {
    throw APIError.failedPrecondition("Supabase provider is not configured");
  }

  const supabaseClient = new SupabaseClient(supabaseApiKey());

  await db.exec`
    INSERT INTO provisioned_databases (
      id, project_id, provider, region, name, status
    ) VALUES (
      ${databaseId}, ${projectId}, 'supabase', ${region}, ${databaseName}, 'provisioning'
    )
  `;

  try {
    const dbPassword = generateSecurePassword();
    const supabaseProject: SupabaseProjectResponse = await supabaseClient.createProject(
      supabaseOrgId(),
      databaseName,
      region,
      dbPassword
    );

    const connectionUri = supabaseClient.buildConnectionString(supabaseProject, dbPassword);
    const config = supabaseClient.parseConnectionString(connectionUri);

    await db.exec`
      UPDATE provisioned_databases
      SET
        status = 'active',
        connection_string = ${connectionUri},
        host = ${config.host},
        port = ${config.port},
        database = ${config.database},
        username = ${config.username},
        updated_at = NOW()
      WHERE id = ${databaseId}
    `;

    const result = await db.queryRow<ProvisionedDatabase>`
      SELECT * FROM provisioned_databases WHERE id = ${databaseId}
    `;

    return result!;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await db.exec`
      UPDATE provisioned_databases
      SET status = 'failed', error_message = ${errorMessage}, updated_at = NOW()
      WHERE id = ${databaseId}
    `;
    throw APIError.internal(`Failed to provision Supabase database: ${errorMessage}`);
  }
}

function generateSecurePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 32; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
