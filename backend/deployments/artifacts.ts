import { api } from "encore.dev/api";
import db from "../db";

export interface DeploymentArtifact {
  id: number;
  deployment_id: number;
  artifact_type: string;
  artifact_name: string;
  version: string;
  file_path: string | null;
  file_hash: string | null;
  file_size: number | null;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface CreateArtifactRequest {
  deployment_id: number;
  artifact_type: string;
  artifact_name: string;
  version: string;
  file_path?: string;
  file_hash?: string;
  file_size?: number;
  metadata?: Record<string, any>;
}

export const createArtifact = api(
  { method: "POST", path: "/deployments/artifacts", expose: true },
  async (req: CreateArtifactRequest): Promise<DeploymentArtifact> => {
    const artifact = await db.queryRow<DeploymentArtifact>`
      INSERT INTO deployment_artifacts (
        deployment_id,
        artifact_type,
        artifact_name,
        version,
        file_path,
        file_hash,
        file_size,
        metadata
      ) VALUES (
        ${req.deployment_id},
        ${req.artifact_type},
        ${req.artifact_name},
        ${req.version},
        ${req.file_path || null},
        ${req.file_hash || null},
        ${req.file_size || null},
        ${JSON.stringify(req.metadata || {})}
      )
      RETURNING *
    `;

    if (!artifact) {
      throw new Error("Failed to create artifact");
    }

    return artifact;
  }
);

export interface ListArtifactsRequest {
  deployment_id: number;
}

export interface ListArtifactsResponse {
  artifacts: DeploymentArtifact[];
}

export const listArtifacts = api(
  { method: "GET", path: "/deployments/:deployment_id/artifacts", expose: true },
  async ({ deployment_id }: ListArtifactsRequest): Promise<ListArtifactsResponse> => {
    const artifacts = await db.query<DeploymentArtifact>`
      SELECT * FROM deployment_artifacts
      WHERE deployment_id = ${deployment_id}
      ORDER BY created_at DESC
    `;

    return { artifacts };
  }
);

export interface DeploymentDiff {
  id: number;
  deployment_a_id: number;
  deployment_b_id: number;
  diff_type: string;
  summary: Record<string, any>;
  details: Record<string, any>;
  files_changed: number;
  lines_added: number;
  lines_removed: number;
  created_at: Date;
}

export interface CompareDeploymentsRequest {
  deployment_a_id: number;
  deployment_b_id: number;
}

export const compareDeployments = api(
  { method: "POST", path: "/deployments/compare", expose: true },
  async (req: CompareDeploymentsRequest): Promise<DeploymentDiff> => {
    const existingDiff = await db.queryRow<DeploymentDiff>`
      SELECT * FROM deployment_diffs
      WHERE deployment_a_id = ${req.deployment_a_id}
        AND deployment_b_id = ${req.deployment_b_id}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (existingDiff) {
      return existingDiff;
    }

    const artifactsA = await db.query<DeploymentArtifact>`
      SELECT * FROM deployment_artifacts
      WHERE deployment_id = ${req.deployment_a_id}
    `;

    const artifactsB = await db.query<DeploymentArtifact>`
      SELECT * FROM deployment_artifacts
      WHERE deployment_id = ${req.deployment_b_id}
    `;

    const artifactMapA = new Map(artifactsA.map(a => [a.artifact_name, a]));
    const artifactMapB = new Map(artifactsB.map(a => [a.artifact_name, a]));

    const allArtifactNames = new Set([...artifactMapA.keys(), ...artifactMapB.keys()]);
    const changes: any[] = [];
    let filesChanged = 0;

    for (const name of allArtifactNames) {
      const artifactA = artifactMapA.get(name);
      const artifactB = artifactMapB.get(name);

      if (!artifactA && artifactB) {
        changes.push({
          artifact_name: name,
          change_type: 'added',
          version_b: artifactB.version,
        });
        filesChanged++;
      } else if (artifactA && !artifactB) {
        changes.push({
          artifact_name: name,
          change_type: 'removed',
          version_a: artifactA.version,
        });
        filesChanged++;
      } else if (artifactA && artifactB && artifactA.version !== artifactB.version) {
        changes.push({
          artifact_name: name,
          change_type: 'modified',
          version_a: artifactA.version,
          version_b: artifactB.version,
          hash_changed: artifactA.file_hash !== artifactB.file_hash,
        });
        filesChanged++;
      }
    }

    const summary = {
      total_artifacts_a: artifactsA.length,
      total_artifacts_b: artifactsB.length,
      files_changed: filesChanged,
      added: changes.filter(c => c.change_type === 'added').length,
      removed: changes.filter(c => c.change_type === 'removed').length,
      modified: changes.filter(c => c.change_type === 'modified').length,
    };

    const diff = await db.queryRow<DeploymentDiff>`
      INSERT INTO deployment_diffs (
        deployment_a_id,
        deployment_b_id,
        diff_type,
        summary,
        details,
        files_changed
      ) VALUES (
        ${req.deployment_a_id},
        ${req.deployment_b_id},
        'artifact_comparison',
        ${JSON.stringify(summary)},
        ${JSON.stringify({ changes })},
        ${filesChanged}
      )
      RETURNING *
    `;

    if (!diff) {
      throw new Error("Failed to create diff");
    }

    return diff;
  }
);

export interface ArtifactVersion {
  id: number;
  project_id: number;
  artifact_name: string;
  version: string;
  previous_version: string | null;
  commit_hash: string | null;
  build_number: string | null;
  changelog: string | null;
  is_latest: boolean;
  metadata: Record<string, any>;
  created_by: string | null;
  created_at: Date;
}

export interface CreateVersionRequest {
  project_id: number;
  artifact_name: string;
  version: string;
  previous_version?: string;
  commit_hash?: string;
  build_number?: string;
  changelog?: string;
  is_latest?: boolean;
  metadata?: Record<string, any>;
  created_by?: string;
}

export const createVersion = api(
  { method: "POST", path: "/deployments/versions", expose: true },
  async (req: CreateVersionRequest): Promise<ArtifactVersion> => {
    const version = await db.queryRow<ArtifactVersion>`
      INSERT INTO artifact_versions (
        project_id,
        artifact_name,
        version,
        previous_version,
        commit_hash,
        build_number,
        changelog,
        is_latest,
        metadata,
        created_by
      ) VALUES (
        ${req.project_id},
        ${req.artifact_name},
        ${req.version},
        ${req.previous_version || null},
        ${req.commit_hash || null},
        ${req.build_number || null},
        ${req.changelog || null},
        ${req.is_latest !== undefined ? req.is_latest : true},
        ${JSON.stringify(req.metadata || {})},
        ${req.created_by || null}
      )
      RETURNING *
    `;

    if (!version) {
      throw new Error("Failed to create version");
    }

    return version;
  }
);

export interface ListVersionsRequest {
  project_id: number;
  artifact_name?: string;
  limit?: number;
}

export interface ListVersionsResponse {
  versions: ArtifactVersion[];
}

export const listVersions = api(
  { method: "GET", path: "/projects/:project_id/versions", expose: true },
  async (req: ListVersionsRequest): Promise<ListVersionsResponse> => {
    let query = `
      SELECT * FROM artifact_versions
      WHERE project_id = $1
    `;
    const params: any[] = [req.project_id];
    let paramCount = 1;

    if (req.artifact_name) {
      paramCount++;
      query += ` AND artifact_name = $${paramCount}`;
      params.push(req.artifact_name);
    }

    query += ` ORDER BY created_at DESC`;

    if (req.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(req.limit);
    }

    const versions = await db.query<ArtifactVersion>(query as any, ...params);

    return { versions };
  }
);

export interface GetLatestVersionRequest {
  project_id: number;
  artifact_name: string;
}

export const getLatestVersion = api(
  { method: "GET", path: "/projects/:project_id/versions/:artifact_name/latest", expose: true },
  async (req: GetLatestVersionRequest): Promise<ArtifactVersion> => {
    const version = await db.queryRow<ArtifactVersion>`
      SELECT * FROM artifact_versions
      WHERE project_id = ${req.project_id}
        AND artifact_name = ${req.artifact_name}
        AND is_latest = true
      LIMIT 1
    `;

    if (!version) {
      throw new Error("No latest version found");
    }

    return version;
  }
);