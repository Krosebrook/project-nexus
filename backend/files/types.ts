export interface FileMove {
  id: number;
  project_id: number;
  original_path: string;
  new_path: string;
  reason: string | null;
  moved_at: Date;
}
