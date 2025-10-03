-- Deployment approvals table
CREATE TABLE deployment_approvals (
  id BIGSERIAL PRIMARY KEY,
  deployment_id BIGINT NOT NULL REFERENCES deployment_logs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  required_approvals INTEGER NOT NULL DEFAULT 1,
  approval_count INTEGER NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES users(id),
  approved_by BIGINT[] DEFAULT ARRAY[]::BIGINT[],
  rejected_by BIGINT REFERENCES users(id),
  rejection_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_deployment_approvals_deployment_id ON deployment_approvals(deployment_id);
CREATE INDEX idx_deployment_approvals_status ON deployment_approvals(status);
CREATE INDEX idx_deployment_approvals_created_by ON deployment_approvals(created_by);

-- Approval rules table
CREATE TABLE approval_rules (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  environment TEXT NOT NULL,
  required_approvals INTEGER NOT NULL DEFAULT 1,
  auto_approve_after INTERVAL,
  allowed_approvers BIGINT[] DEFAULT ARRAY[]::BIGINT[],
  conditions JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approval_rules_project_id ON approval_rules(project_id);
CREATE INDEX idx_approval_rules_environment ON approval_rules(environment);
CREATE INDEX idx_approval_rules_is_active ON approval_rules(is_active);

-- Approval actions table
CREATE TABLE approval_actions (
  id BIGSERIAL PRIMARY KEY,
  approval_id BIGINT NOT NULL REFERENCES deployment_approvals(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  comment TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approval_actions_approval_id ON approval_actions(approval_id);
CREATE INDEX idx_approval_actions_user_id ON approval_actions(user_id);
CREATE INDEX idx_approval_actions_action ON approval_actions(action);