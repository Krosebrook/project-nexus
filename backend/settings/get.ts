import { api } from "encore.dev/api";
import db from "../db";
import type { UserPreferences } from "./types";

interface GetSettingsResponse {
  settings: UserPreferences;
}

// Retrieves user preferences.
export const get = api<void, GetSettingsResponse>(
  { expose: true, method: "GET", path: "/settings" },
  async () => {
    let settings = await db.queryRow<UserPreferences>`
      SELECT id, user_id, refresh_interval, default_view, theme, preferences, created_at, updated_at
      FROM user_preferences
      WHERE user_id = 'default'
    `;

    if (!settings) {
      settings = await db.queryRow<UserPreferences>`
        INSERT INTO user_preferences (user_id)
        VALUES ('default')
        RETURNING id, user_id, refresh_interval, default_view, theme, preferences, created_at, updated_at
      `;
    }

    return { settings: settings! };
  }
);
