CREATE TABLE IF NOT EXISTS deployment_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  template_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  stages JSONB NOT NULL DEFAULT '[]',
  variables JSONB NOT NULL DEFAULT '[]',
  diagram_data JSONB DEFAULT '{}',
  is_built_in BOOLEAN NOT NULL DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deployment_templates_category ON deployment_templates(category);
CREATE INDEX idx_deployment_templates_type ON deployment_templates(template_type);
CREATE INDEX idx_deployment_templates_usage_count ON deployment_templates(usage_count DESC);

INSERT INTO deployment_templates (name, description, category, template_type, config, stages, variables, is_built_in, diagram_data) VALUES
(
  'Simple Deploy',
  'Single environment deployment with basic health check',
  'basic',
  'simple',
  '{"healthCheck": true, "timeout": 300, "rollbackOnFailure": true}',
  '[
    {"name": "validate", "description": "Validate deployment configuration"},
    {"name": "build", "description": "Build application artifacts"},
    {"name": "deploy", "description": "Deploy to target environment"},
    {"name": "health_check", "description": "Verify application health"}
  ]',
  '[
    {"name": "PROJECT_NAME", "description": "Name of the project", "required": true},
    {"name": "ENVIRONMENT", "description": "Target environment", "default": "production"},
    {"name": "HEALTH_ENDPOINT", "description": "Health check endpoint", "default": "/health"}
  ]',
  true,
  '{"nodes": [{"id": "1", "label": "Validate", "type": "stage"}, {"id": "2", "label": "Build", "type": "stage"}, {"id": "3", "label": "Deploy", "type": "stage"}, {"id": "4", "label": "Health Check", "type": "stage"}], "edges": [{"from": "1", "to": "2"}, {"from": "2", "to": "3"}, {"from": "3", "to": "4"}]}'
),
(
  'Blue-Green Deploy',
  'Zero-downtime deployment with traffic switching between two environments',
  'advanced',
  'blue-green',
  '{"slots": ["blue", "green"], "trafficSwitchDelay": 60, "keepBothActive": false}',
  '[
    {"name": "prepare_green", "description": "Prepare green environment"},
    {"name": "deploy_to_green", "description": "Deploy to green environment"},
    {"name": "smoke_test_green", "description": "Run smoke tests on green"},
    {"name": "switch_traffic", "description": "Switch traffic from blue to green"},
    {"name": "monitor", "description": "Monitor green environment"},
    {"name": "decommission_blue", "description": "Decommission blue environment"}
  ]',
  '[
    {"name": "PROJECT_NAME", "description": "Name of the project", "required": true},
    {"name": "BLUE_ENV", "description": "Blue environment name", "default": "production-blue"},
    {"name": "GREEN_ENV", "description": "Green environment name", "default": "production-green"},
    {"name": "TRAFFIC_SWITCH_DELAY", "description": "Delay before traffic switch (seconds)", "default": "60"}
  ]',
  true,
  '{"nodes": [{"id": "1", "label": "Prepare Green", "type": "stage"}, {"id": "2", "label": "Deploy Green", "type": "stage"}, {"id": "3", "label": "Smoke Test", "type": "stage"}, {"id": "4", "label": "Switch Traffic", "type": "decision"}, {"id": "5", "label": "Monitor", "type": "stage"}, {"id": "6", "label": "Decommission Blue", "type": "stage"}], "edges": [{"from": "1", "to": "2"}, {"from": "2", "to": "3"}, {"from": "3", "to": "4"}, {"from": "4", "to": "5"}, {"from": "5", "to": "6"}]}'
),
(
  'Canary Deploy',
  'Gradual rollout with incremental traffic percentage (10% → 50% → 100%)',
  'advanced',
  'canary',
  '{"canaryStages": [10, 50, 100], "stageDelay": 300, "autoPromote": false}',
  '[
    {"name": "deploy_canary", "description": "Deploy canary version"},
    {"name": "route_10_percent", "description": "Route 10% traffic to canary"},
    {"name": "monitor_10_percent", "description": "Monitor canary at 10%"},
    {"name": "route_50_percent", "description": "Route 50% traffic to canary"},
    {"name": "monitor_50_percent", "description": "Monitor canary at 50%"},
    {"name": "route_100_percent", "description": "Route 100% traffic to canary"},
    {"name": "monitor_full", "description": "Monitor full rollout"}
  ]',
  '[
    {"name": "PROJECT_NAME", "description": "Name of the project", "required": true},
    {"name": "CANARY_ENVIRONMENT", "description": "Canary environment", "default": "production-canary"},
    {"name": "STAGE_DELAY", "description": "Delay between stages (seconds)", "default": "300"},
    {"name": "ERROR_THRESHOLD", "description": "Max error rate before rollback", "default": "5"}
  ]',
  true,
  '{"nodes": [{"id": "1", "label": "Deploy Canary", "type": "stage"}, {"id": "2", "label": "10% Traffic", "type": "stage"}, {"id": "3", "label": "Monitor 10%", "type": "stage"}, {"id": "4", "label": "50% Traffic", "type": "stage"}, {"id": "5", "label": "Monitor 50%", "type": "stage"}, {"id": "6", "label": "100% Traffic", "type": "stage"}], "edges": [{"from": "1", "to": "2"}, {"from": "2", "to": "3"}, {"from": "3", "to": "4"}, {"from": "4", "to": "5"}, {"from": "5", "to": "6"}]}'
),
(
  'Multi-Region Deploy',
  'Sequential deployment to multiple regions with validation',
  'advanced',
  'multi-region',
  '{"regions": ["us-east-1", "us-west-2", "eu-west-1"], "sequential": true, "waitBetweenRegions": 120}',
  '[
    {"name": "deploy_us_east", "description": "Deploy to US East"},
    {"name": "validate_us_east", "description": "Validate US East deployment"},
    {"name": "deploy_us_west", "description": "Deploy to US West"},
    {"name": "validate_us_west", "description": "Validate US West deployment"},
    {"name": "deploy_eu_west", "description": "Deploy to EU West"},
    {"name": "validate_eu_west", "description": "Validate EU West deployment"}
  ]',
  '[
    {"name": "PROJECT_NAME", "description": "Name of the project", "required": true},
    {"name": "REGION_1", "description": "First region", "default": "us-east-1"},
    {"name": "REGION_2", "description": "Second region", "default": "us-west-2"},
    {"name": "REGION_3", "description": "Third region", "default": "eu-west-1"},
    {"name": "WAIT_BETWEEN_REGIONS", "description": "Wait time between regions (seconds)", "default": "120"}
  ]',
  true,
  '{"nodes": [{"id": "1", "label": "US East", "type": "region"}, {"id": "2", "label": "Validate", "type": "stage"}, {"id": "3", "label": "US West", "type": "region"}, {"id": "4", "label": "Validate", "type": "stage"}, {"id": "5", "label": "EU West", "type": "region"}, {"id": "6", "label": "Validate", "type": "stage"}], "edges": [{"from": "1", "to": "2"}, {"from": "2", "to": "3"}, {"from": "3", "to": "4"}, {"from": "4", "to": "5"}, {"from": "5", "to": "6"}]}'
),
(
  'Database Migration + Deploy',
  'Run database migrations before application deployment',
  'advanced',
  'db-migration',
  '{"migrationTimeout": 600, "rollbackOnFailure": true, "backupBeforeMigration": true}',
  '[
    {"name": "backup_database", "description": "Create database backup"},
    {"name": "run_migrations", "description": "Execute database migrations"},
    {"name": "verify_migrations", "description": "Verify migration success"},
    {"name": "deploy_app", "description": "Deploy application"},
    {"name": "smoke_test", "description": "Run smoke tests"},
    {"name": "cleanup", "description": "Clean up old backups"}
  ]',
  '[
    {"name": "PROJECT_NAME", "description": "Name of the project", "required": true},
    {"name": "DATABASE_URL", "description": "Database connection URL", "required": true},
    {"name": "MIGRATION_TIMEOUT", "description": "Migration timeout (seconds)", "default": "600"},
    {"name": "BACKUP_RETENTION", "description": "Backup retention (days)", "default": "7"}
  ]',
  true,
  '{"nodes": [{"id": "1", "label": "Backup DB", "type": "stage"}, {"id": "2", "label": "Migrate", "type": "stage"}, {"id": "3", "label": "Verify", "type": "stage"}, {"id": "4", "label": "Deploy App", "type": "stage"}, {"id": "5", "label": "Smoke Test", "type": "stage"}, {"id": "6", "label": "Cleanup", "type": "stage"}], "edges": [{"from": "1", "to": "2"}, {"from": "2", "to": "3"}, {"from": "3", "to": "4"}, {"from": "4", "to": "5"}, {"from": "5", "to": "6"}]}'
);

CREATE TABLE IF NOT EXISTS deployment_from_template (
  id BIGSERIAL PRIMARY KEY,
  deployment_id BIGINT NOT NULL REFERENCES deployment_logs(id) ON DELETE CASCADE,
  template_id BIGINT NOT NULL REFERENCES deployment_templates(id) ON DELETE CASCADE,
  variable_values JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deployment_from_template_deployment_id ON deployment_from_template(deployment_id);
CREATE INDEX idx_deployment_from_template_template_id ON deployment_from_template(template_id);

CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE deployment_templates
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = NEW.template_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_template_usage
AFTER INSERT ON deployment_from_template
FOR EACH ROW
EXECUTE FUNCTION increment_template_usage();
