import { api } from "encore.dev/api";
import db from "../db";
import type { ProjectDependency } from "./types";

interface AddDependencyRequest {
  project_id: number;
  depends_on_project_id: number;
  dependency_type: 'direct' | 'transitive' | 'dev';
  version_constraint?: string;
}

interface DependencyGraph {
  nodes: Array<{ id: number; name: string }>;
  edges: Array<{ from: number; to: number; type: string }>;
}

export const addDependency = api(
  { method: "POST", path: "/dependencies", expose: true },
  async (req: AddDependencyRequest): Promise<ProjectDependency> => {

    
    if (req.project_id === req.depends_on_project_id) {
      throw new Error("Project cannot depend on itself");
    }
    
    const cycleCheck = await detectCycle(req.depends_on_project_id, req.project_id);
    if (cycleCheck) {
      throw new Error("Adding this dependency would create a circular dependency");
    }
    
    const dependency = await db.queryRow<ProjectDependency>`
      INSERT INTO project_dependencies (
        project_id,
        depends_on_project_id,
        dependency_type,
        version_constraint
      ) VALUES (
        ${req.project_id},
        ${req.depends_on_project_id},
        ${req.dependency_type},
        ${req.version_constraint || null}
      )
      ON CONFLICT (project_id, depends_on_project_id) 
      DO UPDATE SET 
        dependency_type = ${req.dependency_type},
        version_constraint = ${req.version_constraint || null}
      RETURNING *
    `;
    
    if (!dependency) {
      throw new Error("Failed to add dependency");
    }
    
    return dependency;
  }
);

interface ListDependenciesResponse {
  dependencies: ProjectDependency[];
}

export const listDependencies = api(
  { method: "GET", path: "/dependencies/:projectId", expose: true },
  async ({ projectId }: { projectId: number }): Promise<ListDependenciesResponse> => {

    
    const deps = await db.queryAll<ProjectDependency>`
      SELECT * FROM project_dependencies 
      WHERE project_id = ${projectId}
      ORDER BY dependency_type, created_at
    `;
    
    return { dependencies: deps };
  }
);

export const getDependencyGraph = api(
  { method: "GET", path: "/dependencies/:projectId/graph", expose: true },
  async ({ projectId }: { projectId: number }): Promise<DependencyGraph> => {

    
    const visited = new Set<number>();
    const nodes: Array<{ id: number; name: string }> = [];
    const edges: Array<{ from: number; to: number; type: string }> = [];
    
    await buildGraph(projectId, visited, nodes, edges);
    
    return { nodes, edges };
  }
);

async function buildGraph(
  projectId: number,
  visited: Set<number>,
  nodes: Array<{ id: number; name: string }>,
  edges: Array<{ from: number; to: number; type: string }>
): Promise<void> {
  if (visited.has(projectId)) {
    return;
  }
  
  visited.add(projectId);

  
  const project = await db.queryRow<{ id: number; name: string }>`
    SELECT id, name FROM projects WHERE id = ${projectId}
  `;
  
  if (!project) {
    return;
  }
  
  nodes.push(project);
  
  const deps = await db.queryAll<ProjectDependency>`
    SELECT * FROM project_dependencies WHERE project_id = ${projectId}
  `;
  
  for (let i = 0; i < deps.length; i++) {
    const dep = deps[i];
    edges.push({
      from: dep.project_id,
      to: dep.depends_on_project_id,
      type: dep.dependency_type
    });
    
    await buildGraph(dep.depends_on_project_id, visited, nodes, edges);
  }
}

async function detectCycle(fromId: number, toId: number): Promise<boolean> {

  const visited = new Set<number>();
  const stack = [fromId];
  
  while (stack.length > 0) {
    const current = stack.pop()!;
    
    if (current === toId) {
      return true;
    }
    
    if (visited.has(current)) {
      continue;
    }
    
    visited.add(current);
    
    const deps = await db.queryAll<ProjectDependency>`
      SELECT * FROM project_dependencies WHERE project_id = ${current}
    `;
    
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i];
      stack.push(dep.depends_on_project_id);
    }
  }
  
  return false;
}

export const removeDependency = api(
  { method: "DELETE", path: "/dependencies/remove/:id", expose: true },
  async ({ id }: { id: number }): Promise<void> => {

    
    await db.exec`
      DELETE FROM project_dependencies WHERE id = ${id}
    `;
  }
);