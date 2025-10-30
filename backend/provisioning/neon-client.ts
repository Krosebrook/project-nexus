import type { NeonProjectResponse, NeonConnectionConfig } from "./types";

const NEON_API_BASE = "https://console.neon.tech/api/v2";

export class NeonClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createProject(name: string, region: string = "aws-us-east-2"): Promise<NeonProjectResponse> {
    const response = await fetch(`${NEON_API_BASE}/projects`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        project: {
          name,
          region_id: region,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Neon API error (${response.status}): ${errorText}`);
    }

    return await response.json() as NeonProjectResponse;
  }

  async deleteProject(projectId: string): Promise<void> {
    const response = await fetch(`${NEON_API_BASE}/projects/${projectId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(`Neon API error (${response.status}): ${errorText}`);
    }
  }

  async getProject(projectId: string): Promise<NeonProjectResponse> {
    const response = await fetch(`${NEON_API_BASE}/projects/${projectId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Neon API error (${response.status}): ${errorText}`);
    }

    return await response.json() as NeonProjectResponse;
  }

  parseConnectionString(connectionUri: string): NeonConnectionConfig {
    const url = new URL(connectionUri);
    
    return {
      host: url.hostname,
      port: parseInt(url.port || "5432", 10),
      database: url.pathname.slice(1),
      username: url.username,
      password: url.password,
      sslmode: url.searchParams.get("sslmode") || "require",
    };
  }
}
