export interface User {
  id: number;
  user_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: "admin" | "developer" | "viewer";
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: "owner" | "admin" | "member" | "viewer";
  permissions: Record<string, boolean>;
  invited_by?: number;
  joined_at: Date;
  user?: User;
}

export interface ActivityLog {
  id: number;
  project_id?: number;
  user_id?: number;
  action_type: string;
  entity_type?: string;
  entity_id?: number;
  description: string;
  metadata: Record<string, any>;
  created_at: Date;
  user?: User;
}

export interface Comment {
  id: number;
  project_id: number;
  user_id: number;
  entity_type: string;
  entity_id: number;
  content: string;
  parent_id?: number;
  is_resolved: boolean;
  created_at: Date;
  updated_at: Date;
  user?: User;
  replies?: Comment[];
}

export interface UserPresence {
  id: number;
  user_id: number;
  project_id?: number;
  status: "online" | "away" | "offline";
  current_page?: string;
  metadata: Record<string, any>;
  last_seen: Date;
  user?: User;
}

export interface CreateUserRequest {
  user_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role?: "admin" | "developer" | "viewer";
}

export interface AddMemberRequest {
  project_id: number;
  user_id: number;
  role?: "owner" | "admin" | "member" | "viewer";
  permissions?: Record<string, boolean>;
  invited_by?: number;
}

export interface CreateCommentRequest {
  project_id: number;
  user_id: number;
  entity_type: string;
  entity_id: number;
  content: string;
  parent_id?: number;
}

export interface UpdatePresenceRequest {
  user_id: number;
  project_id?: number;
  status: "online" | "away" | "offline";
  current_page?: string;
  metadata?: Record<string, any>;
}

export interface LogActivityRequest {
  project_id?: number;
  user_id?: number;
  action_type: string;
  entity_type?: string;
  entity_id?: number;
  description: string;
  metadata?: Record<string, any>;
}