import { api } from "encore.dev/api";
import db from "../db";
import type { Incident, IncidentSeverity, IncidentStatus } from "./types";

interface CreateIncidentRequest {
  project_id: number;
  deployment_id?: number;
  severity: IncidentSeverity;
  title: string;
  description?: string;
}

interface UpdateIncidentRequest {
  id: number;
  status?: IncidentStatus;
  description?: string;
}

export const createIncident = api(
  { method: "POST", path: "/incidents", expose: true },
  async (req: CreateIncidentRequest): Promise<Incident> => {

    
    const incident = await db.queryRow<Incident>`
      INSERT INTO incidents (
        project_id,
        deployment_id,
        severity,
        title,
        description
      ) VALUES (
        ${req.project_id},
        ${req.deployment_id || null},
        ${req.severity},
        ${req.title},
        ${req.description || null}
      )
      RETURNING *
    `;
    
    if (!incident) {
      throw new Error("Failed to create incident");
    }
    
    return incident;
  }
);

interface ListIncidentsResponse {
  incidents: Incident[];
}

export const listIncidents = api(
  { method: "GET", path: "/incidents/:projectId", expose: true },
  async ({ projectId, status }: { projectId: number; status?: IncidentStatus }): Promise<ListIncidentsResponse> => {

    
    let incidents: Incident[];
    
    if (status) {
      incidents = await db.queryAll<Incident>`
        SELECT * FROM incidents 
        WHERE project_id = ${projectId} AND status = ${status}
        ORDER BY created_at DESC
      `;
    } else {
      incidents = await db.queryAll<Incident>`
        SELECT * FROM incidents 
        WHERE project_id = ${projectId}
        ORDER BY created_at DESC
      `;
    }
    
    return { incidents };
  }
);

export const updateIncident = api(
  { method: "PUT", path: "/incidents/:id", expose: true },
  async ({ id, status, description }: UpdateIncidentRequest): Promise<Incident> => {

    
    if (!status && description === undefined) {
      throw new Error("No fields to update");
    }
    
    let incident: Incident | null = null;
    
    if (status && description !== undefined) {
      const shouldSetResolvedAt = status === "resolved" || status === "closed";
      if (shouldSetResolvedAt) {
        incident = await db.queryRow<Incident>`
          UPDATE incidents 
          SET status = ${status}, description = ${description}, resolved_at = NOW(), updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;
      } else {
        incident = await db.queryRow<Incident>`
          UPDATE incidents 
          SET status = ${status}, description = ${description}, updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;
      }
    } else if (status) {
      const shouldSetResolvedAt = status === "resolved" || status === "closed";
      if (shouldSetResolvedAt) {
        incident = await db.queryRow<Incident>`
          UPDATE incidents 
          SET status = ${status}, resolved_at = NOW(), updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;
      } else {
        incident = await db.queryRow<Incident>`
          UPDATE incidents 
          SET status = ${status}, updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;
      }
    } else if (description !== undefined) {
      incident = await db.queryRow<Incident>`
        UPDATE incidents 
        SET description = ${description}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
    }
    
    if (!incident) {
      throw new Error("Incident not found");
    }
    
    return incident;
  }
);

interface IncidentStats {
  open: number;
  investigating: number;
  resolved: number;
  closed: number;
}

export const getIncidentStats = api(
  { method: "GET", path: "/incidents/:projectId/stats", expose: true },
  async ({ projectId }: { projectId: number }): Promise<IncidentStats> => {

    
    const stats = await db.queryAll<{ status: IncidentStatus; count: number }>`
      SELECT status, COUNT(*)::int as count
      FROM incidents 
      WHERE project_id = ${projectId}
      GROUP BY status
    `;
    
    const result: IncidentStats = {
      open: 0,
      investigating: 0,
      resolved: 0,
      closed: 0
    };
    
    for (const stat of stats) {
      result[stat.status] = stat.count;
    }
    
    return result;
  }
);