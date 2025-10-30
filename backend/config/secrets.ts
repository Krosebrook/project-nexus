import { secret } from "encore.dev/config";
import { PROVIDERS } from "./providers";

export const neonApiKey = PROVIDERS.NEON ? secret("NeonAPIKey") : undefined;
export const supabaseApiKey = PROVIDERS.SUPABASE ? secret("SupabaseAPIKey") : undefined;
export const supabaseOrgId = PROVIDERS.SUPABASE ? secret("SupabaseOrgId") : undefined;
export const gcpProjectId = PROVIDERS.GCP ? secret("GCPProjectId") : undefined;
export const gcpSaKey = PROVIDERS.GCP ? secret("GCPServiceAccountKey") : undefined;
