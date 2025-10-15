export interface DashboardWidget {
  id: number;
  user_id: string;
  project_id?: number;
  widget_type: string;
  title: string;
  config: Record<string, any>;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  is_visible: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WidgetTemplate {
  id: number;
  name: string;
  description?: string;
  widget_type: string;
  default_config: Record<string, any>;
  category: string;
  icon?: string;
  is_public: boolean;
  created_at: Date;
}

export interface CreateWidgetRequest {
  user_id: string;
  project_id?: number;
  widget_type: string;
  title: string;
  config?: Record<string, any>;
  position?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface UpdateWidgetRequest {
  widget_id: number;
  title?: string;
  config?: Record<string, any>;
  position?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  is_visible?: boolean;
}

export interface WidgetData {
  widget_id: number;
  data: any;
  timestamp: Date;
}