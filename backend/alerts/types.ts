export interface AlertRule {
  id: number;
  project_id: number;
  name: string;
  condition: string;
  threshold: number;
  notification_channel: string;
  enabled: boolean;
  last_triggered: Date | null;
  created_at: Date;
  updated_at: Date;
}
