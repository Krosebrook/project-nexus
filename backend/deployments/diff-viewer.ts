import { api } from "encore.dev/api";
import db from "../db";
import type { DeploymentDiff, DeploymentArtifact } from "./artifacts";

export interface DetailedDiffRequest {
  deployment_a_id: number;
  deployment_b_id: number;
  include_metadata?: boolean;
}

export interface FileDiff {
  file_name: string;
  change_type: "added" | "removed" | "modified" | "unchanged";
  size_a?: number;
  size_b?: number;
  hash_a?: string;
  hash_b?: string;
  metadata_changes?: Record<string, { old: any; new: any }>;
}

export interface DetailedDiffResponse {
  deployment_a: {
    id: number;
    project_id: number;
    environment_id: number;
    status: string;
    created_at: Date;
  };
  deployment_b: {
    id: number;
    project_id: number;
    environment_id: number;
    status: string;
    created_at: Date;
  };
  summary: {
    total_files: number;
    files_added: number;
    files_removed: number;
    files_modified: number;
    files_unchanged: number;
    total_size_change: number;
  };
  file_diffs: FileDiff[];
  metadata_comparison?: {
    deployment_a_metadata: Record<string, any>;
    deployment_b_metadata: Record<string, any>;
    metadata_changes: Record<string, { old: any; new: any }>;
  };
}

function compareMetadata(
  metadataA: Record<string, any>,
  metadataB: Record<string, any>
): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {};
  const allKeys = new Set([...Object.keys(metadataA), ...Object.keys(metadataB)]);

  for (const key of allKeys) {
    const valueA = metadataA[key];
    const valueB = metadataB[key];

    if (JSON.stringify(valueA) !== JSON.stringify(valueB)) {
      changes[key] = { old: valueA, new: valueB };
    }
  }

  return changes;
}

export const getDetailedDiff = api(
  { method: "POST", path: "/deployments/diff/detailed", expose: true },
  async (req: DetailedDiffRequest): Promise<DetailedDiffResponse> => {
    const [deploymentA, deploymentB] = await Promise.all([
      db.queryRow<{
        id: number;
        project_id: number;
        environment_id: number;
        status: string;
        metadata: Record<string, any>;
        created_at: Date;
      }>`
        SELECT id, project_id, environment_id, status, metadata, created_at
        FROM deployment_logs
        WHERE id = ${req.deployment_a_id}
      `,
      db.queryRow<{
        id: number;
        project_id: number;
        environment_id: number;
        status: string;
        metadata: Record<string, any>;
        created_at: Date;
      }>`
        SELECT id, project_id, environment_id, status, metadata, created_at
        FROM deployment_logs
        WHERE id = ${req.deployment_b_id}
      `,
    ]);

    if (!deploymentA || !deploymentB) {
      throw new Error("One or both deployments not found");
    }

    const [artifactsA, artifactsB] = await Promise.all([
      db.queryAll<DeploymentArtifact>`
        SELECT * FROM deployment_artifacts
        WHERE deployment_id = ${req.deployment_a_id}
      `,
      db.queryAll<DeploymentArtifact>`
        SELECT * FROM deployment_artifacts
        WHERE deployment_id = ${req.deployment_b_id}
      `,
    ]);

    const artifactMapA = new Map(
      artifactsA.map((a) => [a.artifact_name, a])
    );
    const artifactMapB = new Map(
      artifactsB.map((a) => [a.artifact_name, a])
    );

    const allArtifactNames = new Set([
      ...artifactMapA.keys(),
      ...artifactMapB.keys(),
    ]);

    const fileDiffs: FileDiff[] = [];
    let filesAdded = 0;
    let filesRemoved = 0;
    let filesModified = 0;
    let filesUnchanged = 0;
    let totalSizeChange = 0;

    for (const name of allArtifactNames) {
      const artifactA = artifactMapA.get(name);
      const artifactB = artifactMapB.get(name);

      if (!artifactA && artifactB) {
        filesAdded++;
        totalSizeChange += artifactB.file_size || 0;
        fileDiffs.push({
          file_name: name,
          change_type: "added",
          size_b: artifactB.file_size || undefined,
          hash_b: artifactB.file_hash || undefined,
        });
      } else if (artifactA && !artifactB) {
        filesRemoved++;
        totalSizeChange -= artifactA.file_size || 0;
        fileDiffs.push({
          file_name: name,
          change_type: "removed",
          size_a: artifactA.file_size || undefined,
          hash_a: artifactA.file_hash || undefined,
        });
      } else if (artifactA && artifactB) {
        const hashChanged = artifactA.file_hash !== artifactB.file_hash;
        const metadataChanges = req.include_metadata
          ? compareMetadata(artifactA.metadata, artifactB.metadata)
          : undefined;

        if (hashChanged || (metadataChanges && Object.keys(metadataChanges).length > 0)) {
          filesModified++;
          totalSizeChange += (artifactB.file_size || 0) - (artifactA.file_size || 0);
          fileDiffs.push({
            file_name: name,
            change_type: "modified",
            size_a: artifactA.file_size || undefined,
            size_b: artifactB.file_size || undefined,
            hash_a: artifactA.file_hash || undefined,
            hash_b: artifactB.file_hash || undefined,
            metadata_changes: metadataChanges,
          });
        } else {
          filesUnchanged++;
          fileDiffs.push({
            file_name: name,
            change_type: "unchanged",
            size_a: artifactA.file_size || undefined,
            size_b: artifactB.file_size || undefined,
            hash_a: artifactA.file_hash || undefined,
            hash_b: artifactB.file_hash || undefined,
          });
        }
      }
    }

    const response: DetailedDiffResponse = {
      deployment_a: {
        id: deploymentA.id,
        project_id: deploymentA.project_id,
        environment_id: deploymentA.environment_id,
        status: deploymentA.status,
        created_at: deploymentA.created_at,
      },
      deployment_b: {
        id: deploymentB.id,
        project_id: deploymentB.project_id,
        environment_id: deploymentB.environment_id,
        status: deploymentB.status,
        created_at: deploymentB.created_at,
      },
      summary: {
        total_files: allArtifactNames.size,
        files_added: filesAdded,
        files_removed: filesRemoved,
        files_modified: filesModified,
        files_unchanged: filesUnchanged,
        total_size_change: totalSizeChange,
      },
      file_diffs: fileDiffs,
    };

    if (req.include_metadata) {
      const metadataChanges = compareMetadata(
        deploymentA.metadata || {},
        deploymentB.metadata || {}
      );

      response.metadata_comparison = {
        deployment_a_metadata: deploymentA.metadata || {},
        deployment_b_metadata: deploymentB.metadata || {},
        metadata_changes: metadataChanges,
      };
    }

    return response;
  }
);

export interface VersionHistoryRequest {
  project_id: number;
  artifact_name: string;
  limit?: number;
}

export interface VersionHistoryEntry {
  version: string;
  previous_version: string | null;
  commit_hash: string | null;
  build_number: string | null;
  changelog: string | null;
  is_latest: boolean;
  created_by: string | null;
  created_at: Date;
  deployments_count: number;
}

export interface VersionHistoryResponse {
  artifact_name: string;
  total_versions: number;
  history: VersionHistoryEntry[];
}

export const getVersionHistory = api(
  { method: "GET", path: "/projects/:project_id/artifacts/:artifact_name/history", expose: true },
  async (req: VersionHistoryRequest): Promise<VersionHistoryResponse> => {
    const versions = await db.queryAll<{
      id: number;
      version: string;
      previous_version: string | null;
      commit_hash: string | null;
      build_number: string | null;
      changelog: string | null;
      is_latest: boolean;
      created_by: string | null;
      created_at: Date;
    }>`
      SELECT *
      FROM artifact_versions
      WHERE project_id = ${req.project_id}
        AND artifact_name = ${req.artifact_name}
      ORDER BY created_at DESC
      LIMIT ${req.limit || 50}
    `;

    const history: VersionHistoryEntry[] = [];

    for (const version of versions) {
      const deploymentsCount = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM deployment_artifacts
        WHERE artifact_name = ${req.artifact_name}
          AND version = ${version.version}
      `;

      history.push({
        version: version.version,
        previous_version: version.previous_version,
        commit_hash: version.commit_hash,
        build_number: version.build_number,
        changelog: version.changelog,
        is_latest: version.is_latest,
        created_by: version.created_by,
        created_at: version.created_at,
        deployments_count: deploymentsCount?.count || 0,
      });
    }

    return {
      artifact_name: req.artifact_name,
      total_versions: versions.length,
      history,
    };
  }
);

export interface CompareVersionsRequest {
  project_id: number;
  artifact_name: string;
  version_a: string;
  version_b: string;
}

export interface VersionComparison {
  artifact_name: string;
  version_a: {
    version: string;
    commit_hash: string | null;
    build_number: string | null;
    changelog: string | null;
    created_at: Date;
  };
  version_b: {
    version: string;
    commit_hash: string | null;
    build_number: string | null;
    changelog: string | null;
    created_at: Date;
  };
  time_difference_hours: number;
  changelog_diff: string | null;
}

export const compareVersions = api(
  { method: "POST", path: "/projects/:project_id/artifacts/:artifact_name/compare", expose: true },
  async (req: CompareVersionsRequest): Promise<VersionComparison> => {
    const [versionA, versionB] = await Promise.all([
      db.queryRow<{
        version: string;
        commit_hash: string | null;
        build_number: string | null;
        changelog: string | null;
        created_at: Date;
      }>`
        SELECT version, commit_hash, build_number, changelog, created_at
        FROM artifact_versions
        WHERE project_id = ${req.project_id}
          AND artifact_name = ${req.artifact_name}
          AND version = ${req.version_a}
      `,
      db.queryRow<{
        version: string;
        commit_hash: string | null;
        build_number: string | null;
        changelog: string | null;
        created_at: Date;
      }>`
        SELECT version, commit_hash, build_number, changelog, created_at
        FROM artifact_versions
        WHERE project_id = ${req.project_id}
          AND artifact_name = ${req.artifact_name}
          AND version = ${req.version_b}
      `,
    ]);

    if (!versionA || !versionB) {
      throw new Error("One or both versions not found");
    }

    const timeDiff =
      (new Date(versionB.created_at).getTime() -
        new Date(versionA.created_at).getTime()) /
      (1000 * 60 * 60);

    return {
      artifact_name: req.artifact_name,
      version_a: {
        version: versionA.version,
        commit_hash: versionA.commit_hash,
        build_number: versionA.build_number,
        changelog: versionA.changelog,
        created_at: versionA.created_at,
      },
      version_b: {
        version: versionB.version,
        commit_hash: versionB.commit_hash,
        build_number: versionB.build_number,
        changelog: versionB.changelog,
        created_at: versionB.created_at,
      },
      time_difference_hours: timeDiff,
      changelog_diff:
        versionA.changelog && versionB.changelog
          ? `${versionB.changelog}\n---\nPrevious: ${versionA.changelog}`
          : null,
    };
  }
);
