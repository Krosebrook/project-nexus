export interface UserPreferences {
  id: number;
  user_id: string;
  refresh_interval: number;
  default_view: string;
  theme: string;
  preferences: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}
