import { api } from "encore.dev/api";
import db from "../db";
import type { WidgetData } from "./types";

interface GetDataRequest {
  widget_id: number;
}

export const getData = api(
  { method: "GET", path: "/widgets/:widget_id/data", expose: true },
  async (req: GetDataRequest): Promise<WidgetData> => {
    const widget = await db.queryRow<{ id: number; widget_type: string; config: any; project_id?: number }>`
      SELECT id, widget_type, config, project_id FROM dashboard_widgets WHERE id = ${req.widget_id}
    `;

    if (!widget) {
      throw new Error("Widget not found");
    }

    let data: any = {};

    switch (widget.widget_type) {
      case "deployment_status":
        if (widget.project_id) {
          const deployments = await db.rawQueryAll(
            `SELECT * FROM deployments WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2`,
            widget.project_id,
            widget.config.limit || 5
          );
          data = { deployments };
        }
        break;

      case "test_coverage":
        if (widget.project_id) {
          const tests = await db.rawQueryAll(
            `SELECT status, COUNT(*) as count FROM test_cases WHERE project_id = $1 GROUP BY status`,
            widget.project_id
          );
          const total = tests.reduce((sum, t) => sum + Number(t.count), 0);
          const passed = tests.find(t => t.status === 'passed')?.count || 0;
          data = {
            coverage: total > 0 ? (Number(passed) / total * 100).toFixed(2) : 0,
            tests
          };
        }
        break;

      case "active_alerts":
        if (widget.project_id) {
          const alerts = await db.rawQueryAll(
            `SELECT * FROM alert_rules WHERE project_id = $1 AND enabled = true ORDER BY last_triggered DESC LIMIT $2`,
            widget.project_id,
            widget.config.limit || 10
          );
          data = { alerts };
        }
        break;

      case "project_health":
        if (widget.project_id) {
          const project = await db.rawQueryRow(
            `SELECT health_score, metrics FROM projects WHERE id = $1`,
            widget.project_id
          );
          data = project || {};
        }
        break;

      case "recent_activity":
        const activityParams: any[] = [];
        let activityQuery = `SELECT * FROM activity_log`;
        
        if (widget.project_id) {
          activityQuery += ` WHERE project_id = $1`;
          activityParams.push(widget.project_id);
        }
        
        activityQuery += ` ORDER BY created_at DESC LIMIT $${activityParams.length + 1}`;
        activityParams.push(widget.config.limit || 15);
        
        const activity = await db.rawQueryAll(activityQuery, ...activityParams);
        data = { activity };
        break;

      case "team_presence":
        const presenceParams: any[] = [];
        let presenceQuery = `
          SELECT up.*, u.name, u.email, u.avatar_url
          FROM user_presence up
          LEFT JOIN users u ON up.user_id = u.id
          WHERE up.status != 'offline' AND up.last_seen > NOW() - INTERVAL '5 minutes'
        `;
        
        if (widget.project_id) {
          presenceQuery += ` AND up.project_id = $1`;
          presenceParams.push(widget.project_id);
        }
        
        presenceQuery += ` ORDER BY up.last_seen DESC`;
        
        const presence = await db.rawQueryAll(presenceQuery, ...presenceParams);
        data = { presence };
        break;

      default:
        data = { message: "Widget type not implemented" };
    }

    return {
      widget_id: req.widget_id,
      data,
      timestamp: new Date()
    };
  }
);