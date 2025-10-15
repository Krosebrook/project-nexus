export interface DeploymentApproval {
  id: number;
  deployment_id: number;
  status: "pending" | "approved" | "rejected" | "expired";
  required_approvals: number;
  approval_count: number;
  created_by?: number;
  approved_by: number[];
  rejected_by?: number;
  rejection_reason?: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  expires_at?: Date;
}

export interface ApprovalRule {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  environment: string;
  required_approvals: number;
  auto_approve_after?: string;
  allowed_approvers: number[];
  conditions: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ApprovalAction {
  id: number;
  approval_id: number;
  user_id: number;
  action: "approve" | "reject" | "comment";
  comment?: string;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface CreateApprovalRequest {
  deployment_id: number;
  required_approvals?: number;
  created_by?: number;
  expires_at?: Date;
  metadata?: Record<string, any>;
}

export interface ApproveRequest {
  approval_id: number;
  user_id: number;
  comment?: string;
}

export interface RejectRequest {
  approval_id: number;
  user_id: number;
  reason: string;
}

export interface CreateApprovalRuleRequest {
  project_id: number;
  name: string;
  description?: string;
  environment: string;
  required_approvals?: number;
  auto_approve_after?: string;
  allowed_approvers?: number[];
  conditions?: Record<string, any>;
}