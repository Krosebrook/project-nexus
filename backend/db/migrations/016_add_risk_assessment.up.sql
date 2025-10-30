CREATE TABLE IF NOT EXISTS deployment_risk_assessments (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  risk_score INTEGER NOT NULL,
  factors JSONB NOT NULL DEFAULT '[]',
  suggestions JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_assessments_project_id ON deployment_risk_assessments(project_id);
CREATE INDEX idx_risk_assessments_risk_level ON deployment_risk_assessments(risk_level);
CREATE INDEX idx_risk_assessments_created_at ON deployment_risk_assessments(created_at DESC);
CREATE INDEX idx_risk_assessments_risk_score ON deployment_risk_assessments(risk_score DESC);
