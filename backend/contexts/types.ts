export interface ContextSnapshot {
  id: number;
  project_id: number;
  work_state: Record<string, any>;
  next_steps: string[];
  open_files: string[];
  notes: string | null;
  is_current: boolean;
  created_at: Date;
  updated_at: Date;
}
