import { describe, it, expect, beforeAll } from "vitest";
import db from "../../db";

describe("Advanced Alerting Integration Tests", () => {
  let testProjectId: number;
  let testAlertRuleId: number;

  beforeAll(async () => {
    const project = await db.queryRow<{ id: number }>`
      INSERT INTO projects (name)
      VALUES ('Test Alert Project')
      RETURNING id
    `;
    testProjectId = project!.id;

    const rule = await db.queryRow<{ id: number }>`
      INSERT INTO alert_rules (project_id, name, condition, threshold, notification_channel)
      VALUES (${testProjectId}, 'Test Alert', 'cpu > threshold', 80, 'email')
      RETURNING id
    `;
    testAlertRuleId = rule!.id;
  });

  it("should create alert condition", async () => {
    const condition = await db.queryRow<{ id: number; metric_name: string }>`
      INSERT INTO alert_conditions (
        alert_rule_id, condition_type, metric_name, operator, threshold_value
      )
      VALUES (${testAlertRuleId}, 'threshold', 'cpu_usage', 'gt', 80)
      RETURNING id, metric_name
    `;

    expect(condition).toBeDefined();
    expect(condition?.metric_name).toBe('cpu_usage');
  });

  it("should create alert action", async () => {
    const action = await db.queryRow<{ id: number; action_type: string }>`
      INSERT INTO alert_actions (
        alert_rule_id, action_type, action_config
      )
      VALUES (${testAlertRuleId}, 'email', '{"to": "admin@test.com"}'::jsonb)
      RETURNING id, action_type
    `;

    expect(action).toBeDefined();
    expect(action?.action_type).toBe('email');
  });

  it("should create alert history", async () => {
    const history = await db.queryRow<{ id: number; severity: string }>`
      INSERT INTO alert_history (
        alert_rule_id, severity, message, metric_value, threshold_value
      )
      VALUES (${testAlertRuleId}, 'warning', 'CPU usage high', 85, 80)
      RETURNING id, severity
    `;

    expect(history).toBeDefined();
    expect(history?.severity).toBe('warning');
  });

  it("should create escalation rule", async () => {
    const escalation = await db.queryRow<{ id: number; escalation_level: number }>`
      INSERT INTO alert_escalations (
        alert_rule_id, escalation_level, delay_duration, notification_channels
      )
      VALUES (${testAlertRuleId}, 1, '5 minutes', ARRAY['email', 'slack'])
      RETURNING id, escalation_level
    `;

    expect(escalation).toBeDefined();
    expect(escalation?.escalation_level).toBe(1);
  });
});