import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { UserPreferences } from "./types";

interface UpdateSettingsRequest {
  refresh_interval?: number;
  default_view?: string;
  theme?: string;
  preferences?: Record<string, any>;
}

// Updates user preferences.
export const update = api<UpdateSettingsRequest, UserPreferences>(
  { expose: true, method: "PUT", path: "/settings" },
  async ({ refresh_interval, default_view, theme, preferences }) => {
    if (refresh_interval !== undefined && (refresh_interval < 1 || refresh_interval > 300)) {
      throw APIError.invalidArgument("refresh_interval must be between 1 and 300 seconds");
    }
    if (default_view !== undefined) {
      const validViews = ["projects", "automation", "observability", "deployment", "files"];
      if (!validViews.includes(default_view)) {
        throw APIError.invalidArgument(`default_view must be one of: ${validViews.join(", ")}`);
      }
    }
    if (theme !== undefined) {
      const validThemes = ["light", "dark", "system"];
      if (!validThemes.includes(theme)) {
        throw APIError.invalidArgument(`theme must be one of: ${validThemes.join(", ")}`);
      }
    }
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (refresh_interval !== undefined) {
      updates.push(`refresh_interval = $${paramIndex++}`);
      values.push(refresh_interval);
    }
    if (default_view !== undefined) {
      updates.push(`default_view = $${paramIndex++}`);
      values.push(default_view);
    }
    if (theme !== undefined) {
      updates.push(`theme = $${paramIndex++}`);
      values.push(theme);
    }
    if (preferences !== undefined) {
      updates.push(`preferences = $${paramIndex++}`);
      values.push(JSON.stringify(preferences));
    }

    updates.push(`updated_at = NOW()`);

    const query = `
      UPDATE user_preferences
      SET ${updates.join(", ")}
      WHERE user_id = 'default'
      RETURNING id, user_id, refresh_interval, default_view, theme, preferences, created_at, updated_at
    `;

    const settings = await db.rawQueryRow<UserPreferences>(query, ...values);
    return settings!;
  }
);
