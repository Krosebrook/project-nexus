CREATE TABLE deployment_artifacts (
  id BIGSERIAL PRIMARY KEY,
  deployment_id BIGINT NOT NULL REFERENCES deployment_logs(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  artifact_name TEXT NOT NULL,
  version TEXT NOT NULL,
  file_path TEXT,
  file_hash TEXT,
  file_size BIGINT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deployment_artifacts_deployment_id ON deployment_artifacts(deployment_id);
CREATE INDEX idx_deployment_artifacts_type ON deployment_artifacts(artifact_type);
CREATE INDEX idx_deployment_artifacts_version ON deployment_artifacts(version);
CREATE INDEX idx_deployment_artifacts_hash ON deployment_artifacts(file_hash);

CREATE TABLE deployment_diffs (
  id BIGSERIAL PRIMARY KEY,
  deployment_a_id BIGINT NOT NULL REFERENCES deployment_logs(id) ON DELETE CASCADE,
  deployment_b_id BIGINT NOT NULL REFERENCES deployment_logs(id) ON DELETE CASCADE,
  diff_type TEXT NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}',
  details JSONB NOT NULL DEFAULT '{}',
  files_changed INTEGER DEFAULT 0,
  lines_added INTEGER DEFAULT 0,
  lines_removed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deployment_diffs_deployment_a ON deployment_diffs(deployment_a_id);
CREATE INDEX idx_deployment_diffs_deployment_b ON deployment_diffs(deployment_b_id);
CREATE INDEX idx_deployment_diffs_type ON deployment_diffs(diff_type);

CREATE TABLE artifact_versions (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  artifact_name TEXT NOT NULL,
  version TEXT NOT NULL,
  previous_version TEXT,
  commit_hash TEXT,
  build_number TEXT,
  changelog TEXT,
  is_latest BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, artifact_name, version)
);

CREATE INDEX idx_artifact_versions_project_id ON artifact_versions(project_id);
CREATE INDEX idx_artifact_versions_artifact_name ON artifact_versions(artifact_name);
CREATE INDEX idx_artifact_versions_version ON artifact_versions(version);
CREATE INDEX idx_artifact_versions_is_latest ON artifact_versions(project_id, artifact_name, is_latest);
CREATE INDEX idx_artifact_versions_commit_hash ON artifact_versions(commit_hash);

CREATE OR REPLACE FUNCTION update_latest_artifact_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_latest = true THEN
    UPDATE artifact_versions
    SET is_latest = false
    WHERE project_id = NEW.project_id
      AND artifact_name = NEW.artifact_name
      AND id != NEW.id
      AND is_latest = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_latest_artifact_version
BEFORE INSERT OR UPDATE ON artifact_versions
FOR EACH ROW
EXECUTE FUNCTION update_latest_artifact_version();