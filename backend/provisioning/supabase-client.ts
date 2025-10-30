import type { SupabaseProjectResponse, SupabaseConnectionConfig } from "./types";

const SUPABASE_API_BASE = "https://api.supabase.com/v1";

export class SupabaseClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createProject(
    organizationId: string,
    name: string,
    region: string = "us-east-1",
    dbPassword?: string
  ): Promise<SupabaseProjectResponse> {
    const password = dbPassword || this.generatePassword();

    const response = await fetch(`${SUPABASE_API_BASE}/projects`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        organization_id: organizationId,
        name,
        region,
        plan: "free",
        db_pass: password,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase API error (${response.status}): ${errorText}`);
    }

    return await response.json() as SupabaseProjectResponse;
  }

  async deleteProject(projectRef: string): Promise<void> {
    const response = await fetch(`${SUPABASE_API_BASE}/projects/${projectRef}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(`Supabase API error (${response.status}): ${errorText}`);
    }
  }

  async getProject(projectRef: string): Promise<SupabaseProjectResponse> {
    const response = await fetch(`${SUPABASE_API_BASE}/projects/${projectRef}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase API error (${response.status}): ${errorText}`);
    }

    return await response.json() as SupabaseProjectResponse;
  }

  buildConnectionString(project: SupabaseProjectResponse, password: string): string {
    const host = project.database?.host || `db.${project.id}.supabase.co`;
    return `postgresql://postgres:${password}@${host}:5432/postgres`;
  }

  parseConnectionString(connectionUri: string): SupabaseConnectionConfig {
    const url = new URL(connectionUri);

    return {
      host: url.hostname,
      port: parseInt(url.port || "5432", 10),
      database: url.pathname.slice(1) || "postgres",
      username: url.username || "postgres",
      password: url.password,
      sslmode: url.searchParams.get("sslmode") || "require",
    };
  }

  private generatePassword(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 24; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
