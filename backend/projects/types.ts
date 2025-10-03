export type ProjectStatus = "active" | "development" | "maintenance" | "archived" | "critical";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  health_score: number;
  last_activity: Date;
  metrics: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  version?: string;
}
