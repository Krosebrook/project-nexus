export type DatabaseProvider = "neon" | "supabase" | "planetscale";
export type DatabaseStatus = "provisioning" | "active" | "failed" | "deleting" | "deleted";

export interface ProvisionDatabaseRequest {
  projectId: number;
  provider: DatabaseProvider;
  region?: string;
  name?: string;
}

export interface ProvisionedDatabase {
  id: string;
  projectId: number;
  provider: DatabaseProvider;
  region: string;
  name: string;
  status: DatabaseStatus;
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  gcpServiceAccount?: string;
  createdAt: Date;
  updatedAt: Date;
  errorMessage?: string;
}

export interface NeonProjectResponse {
  project: {
    id: string;
    name: string;
    region_id: string;
    created_at: string;
    updated_at: string;
  };
  connection_uris: Array<{
    connection_uri: string;
    connection_parameters: {
      host: string;
      port: number;
      database: string;
      role: string;
    };
  }>;
}

export interface GCPServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export interface NeonConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslmode: string;
}

export interface SupabaseProjectResponse {
  id: string;
  organization_id: string;
  name: string;
  region: string;
  created_at: string;
  database?: {
    host: string;
    version: string;
  };
  status: string;
}

export interface SupabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslmode: string;
}
