CREATE TABLE deployment_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  template_type TEXT NOT NULL,
  stages JSONB NOT NULL DEFAULT '[]',
  stage_config JSONB NOT NULL DEFAULT '{}',
  environment_config JSONB DEFAULT '{}',
  required_approvals INTEGER DEFAULT 0,
  auto_rollback_on_failure BOOLEAN DEFAULT false,
  health_check_config JSONB DEFAULT '{}',
  notification_config JSONB DEFAULT '{}',
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deployment_templates_type ON deployment_templates(template_type);
CREATE INDEX idx_deployment_templates_is_public ON deployment_templates(is_public);
CREATE INDEX idx_deployment_templates_created_by ON deployment_templates(created_by);

INSERT INTO deployment_templates (
  name, 
  description, 
  template_type, 
  stages, 
  stage_config,
  environment_config,
  required_approvals,
  auto_rollback_on_failure
) VALUES
(
  'Standard Production Deployment',
  'Standard deployment pipeline for production environments with full validation',
  'production',
  '["validation", "build", "testing", "migration", "deployment", "health_check", "complete"]',
  '{
    "validation": {"timeout": 300, "strict_mode": true},
    "build": {"timeout": 600, "cache_enabled": true},
    "testing": {"timeout": 900, "min_coverage": 80, "parallel": true},
    "migration": {"timeout": 300, "backup_before": true},
    "deployment": {"timeout": 1200, "blue_green": true},
    "health_check": {"timeout": 300, "retry_count": 3, "endpoints": ["/health", "/ready"]}
  }',
  '{"type": "production", "auto_scale": true, "min_instances": 2}',
  2,
  true
),
(
  'Fast Track Development',
  'Quick deployment for development environments with minimal checks',
  'development',
  '["validation", "build", "deployment", "complete"]',
  '{
    "validation": {"timeout": 60, "strict_mode": false},
    "build": {"timeout": 300, "cache_enabled": true},
    "deployment": {"timeout": 300, "blue_green": false}
  }',
  '{"type": "development", "auto_scale": false}',
  0,
  false
),
(
  'Staging with Full Tests',
  'Staging deployment with comprehensive testing and validation',
  'staging',
  '["validation", "build", "testing", "migration", "deployment", "health_check", "complete"]',
  '{
    "validation": {"timeout": 180, "strict_mode": true},
    "build": {"timeout": 600, "cache_enabled": true},
    "testing": {"timeout": 1200, "min_coverage": 75, "parallel": true, "include_e2e": true},
    "migration": {"timeout": 300, "backup_before": true},
    "deployment": {"timeout": 600, "blue_green": true},
    "health_check": {"timeout": 300, "retry_count": 3, "endpoints": ["/health"]}
  }',
  '{"type": "staging", "auto_scale": true, "min_instances": 1}',
  1,
  true
),
(
  'Hotfix Production',
  'Emergency hotfix deployment with minimal testing',
  'hotfix',
  '["validation", "build", "deployment", "health_check", "complete"]',
  '{
    "validation": {"timeout": 120, "strict_mode": true, "check_diff": true},
    "build": {"timeout": 300, "cache_enabled": true},
    "deployment": {"timeout": 600, "blue_green": true, "canary_percentage": 10},
    "health_check": {"timeout": 180, "retry_count": 5, "endpoints": ["/health", "/ready"]}
  }',
  '{"type": "production", "auto_scale": true, "min_instances": 2}',
  1,
  true
),
(
  'Canary Deployment',
  'Gradual rollout with canary deployment strategy',
  'canary',
  '["validation", "build", "testing", "deployment", "health_check", "canary_validation", "full_rollout", "complete"]',
  '{
    "validation": {"timeout": 180, "strict_mode": true},
    "build": {"timeout": 600, "cache_enabled": true},
    "testing": {"timeout": 900, "min_coverage": 80, "parallel": true},
    "deployment": {"timeout": 600, "canary_percentage": 10, "canary_duration": 600},
    "health_check": {"timeout": 300, "retry_count": 3, "endpoints": ["/health", "/metrics"]},
    "canary_validation": {"timeout": 600, "metric_checks": true, "error_threshold": 0.01},
    "full_rollout": {"timeout": 900, "gradual_percentage": 25}
  }',
  '{"type": "production", "auto_scale": true, "min_instances": 3}',
  2,
  true
);

CREATE TABLE project_deployment_templates (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  template_id BIGINT NOT NULL REFERENCES deployment_templates(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  override_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, template_id)
);

CREATE INDEX idx_project_deployment_templates_project_id ON project_deployment_templates(project_id);
CREATE INDEX idx_project_deployment_templates_template_id ON project_deployment_templates(template_id);
CREATE INDEX idx_project_deployment_templates_is_default ON project_deployment_templates(project_id, is_default);