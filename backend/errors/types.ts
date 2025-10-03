export interface ErrorLog {
  id: number;
  session_id?: string;
  user_id?: string;
  error_type: string;
  error_message: string;
  error_stack?: string;
  component_stack?: string;
  url?: string;
  user_agent?: string;
  timestamp: Date;
  metadata: Record<string, any>;
  severity: "info" | "warning" | "error" | "critical";
  is_resolved: boolean;
}

export interface LogErrorRequest {
  session_id?: string;
  user_id?: string;
  error_type: string;
  error_message: string;
  error_stack?: string;
  component_stack?: string;
  url?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
  severity?: "info" | "warning" | "error" | "critical";
}

export interface ErrorStats {
  total_errors: number;
  errors_by_type: Record<string, number>;
  errors_by_severity: Record<string, number>;
  recent_errors: ErrorLog[];
}