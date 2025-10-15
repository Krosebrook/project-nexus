import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { EvaluateRuleRequest, EvaluationResult } from "./advanced_types";

export const evaluateRule = api(
  { method: "POST", path: "/alerts/rules/:alert_rule_id/evaluate", expose: true },
  async (req: EvaluateRuleRequest): Promise<EvaluationResult> => {
    const rule = await db.queryRow<{ id: number; project_id: number }>`
      SELECT id, project_id FROM alert_rules WHERE id = ${req.alert_rule_id}
    `;

    if (!rule) {
      throw APIError.notFound("Alert rule not found");
    }

    const conditions = await db.queryAll<{
      id: number;
      metric_name: string;
      operator: string;
      threshold_value: number;
      aggregation: string;
      time_window: string;
    }>`
      SELECT * FROM alert_conditions
      WHERE alert_rule_id = ${req.alert_rule_id}
      ORDER BY evaluation_order
    `;

    if (conditions.length === 0) {
      return {
        triggered: false,
        conditions_met: [],
        metric_values: {},
        message: "No conditions configured"
      };
    }

    const conditionsMet: number[] = [];
    const metricValues: Record<string, number> = {};

    for (const condition of conditions) {
      let metricValue: number;

      if (req.current_metrics && req.current_metrics[condition.metric_name] !== undefined) {
        metricValue = req.current_metrics[condition.metric_name];
      } else {
        const project = await db.queryRow<{ metrics: any }>`
          SELECT metrics FROM projects WHERE id = ${rule.project_id}
        `;
        
        if (project && project.metrics && project.metrics[condition.metric_name] !== undefined) {
          metricValue = Number(project.metrics[condition.metric_name]);
        } else {
          continue;
        }
      }

      metricValues[condition.metric_name] = metricValue;

      let conditionMet = false;
      switch (condition.operator) {
        case "gt":
          conditionMet = metricValue > condition.threshold_value;
          break;
        case "lt":
          conditionMet = metricValue < condition.threshold_value;
          break;
        case "gte":
          conditionMet = metricValue >= condition.threshold_value;
          break;
        case "lte":
          conditionMet = metricValue <= condition.threshold_value;
          break;
        case "eq":
          conditionMet = metricValue === condition.threshold_value;
          break;
        case "neq":
          conditionMet = metricValue !== condition.threshold_value;
          break;
      }

      if (conditionMet) {
        conditionsMet.push(condition.id);
      }
    }

    const triggered = conditionsMet.length > 0;
    
    let message = "";
    if (triggered) {
      const metricNames = conditionsMet.map(id => {
        const cond = conditions.find(c => c.id === id);
        return cond?.metric_name || "unknown";
      });
      message = `Alert triggered: ${metricNames.join(", ")} exceeded threshold`;
    } else {
      message = "All conditions within normal range";
    }

    return {
      triggered,
      conditions_met: conditionsMet,
      metric_values: metricValues,
      message
    };
  }
);