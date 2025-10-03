import { describe, it, expect, beforeAll } from "vitest";
import db from "../../db";

describe("Widgets Integration Tests", () => {
  const testUserId = "test_widget_user";

  beforeAll(async () => {
    await db.exec`
      DELETE FROM dashboard_widgets WHERE user_id = ${testUserId}
    `;
  });

  it("should create a widget", async () => {
    const widget = await db.queryRow<{ id: number; widget_type: string }>`
      INSERT INTO dashboard_widgets (user_id, widget_type, title, config)
      VALUES (
        ${testUserId},
        'deployment_status',
        'My Deployments',
        '{"showHistory": true}'::jsonb
      )
      RETURNING id, widget_type
    `;

    expect(widget).toBeDefined();
    expect(widget?.widget_type).toBe('deployment_status');
  });

  it("should list widget templates", async () => {
    const templates = await db.queryAll`
      SELECT * FROM widget_templates
      WHERE is_public = true
      LIMIT 5
    `;

    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);
  });

  it("should update widget position", async () => {
    const widget = await db.queryRow<{ id: number }>`
      INSERT INTO dashboard_widgets (user_id, widget_type, title, config)
      VALUES (${testUserId}, 'test_widget', 'Test', '{}'::jsonb)
      RETURNING id
    `;

    const updated = await db.queryRow<{ position: any }>`
      UPDATE dashboard_widgets
      SET position = '{"x": 4, "y": 2, "w": 6, "h": 4}'::jsonb
      WHERE id = ${widget!.id}
      RETURNING position
    `;

    expect(updated?.position.x).toBe(4);
    expect(updated?.position.y).toBe(2);
  });

  it("should toggle widget visibility", async () => {
    const widget = await db.queryRow<{ id: number }>`
      INSERT INTO dashboard_widgets (user_id, widget_type, title, config)
      VALUES (${testUserId}, 'test_widget_2', 'Test 2', '{}'::jsonb)
      RETURNING id
    `;

    const hidden = await db.queryRow<{ is_visible: boolean }>`
      UPDATE dashboard_widgets
      SET is_visible = false
      WHERE id = ${widget!.id}
      RETURNING is_visible
    `;

    expect(hidden?.is_visible).toBe(false);
  });
});