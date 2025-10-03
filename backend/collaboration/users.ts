import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { User, CreateUserRequest } from "./types";
import { UserSchema, validateSchema } from "../shared/validation";

export const createUser = api(
  { method: "POST", path: "/collaboration/users", expose: true },
  async (req: CreateUserRequest): Promise<User> => {
    validateSchema(UserSchema, req);
    const result = await db.queryRow<User>`
      INSERT INTO users (user_id, email, name, avatar_url, role)
      VALUES (
        ${req.user_id},
        ${req.email},
        ${req.name},
        ${req.avatar_url || null},
        ${req.role || "developer"}
      )
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to create user");
    }

    return result;
  }
);

export const getUser = api(
  { method: "GET", path: "/collaboration/users/:user_id", expose: true },
  async ({ user_id }: { user_id: string }): Promise<User> => {
    const result = await db.queryRow<User>`
      SELECT * FROM users WHERE user_id = ${user_id}
    `;

    if (!result) {
      throw APIError.notFound("User not found");
    }

    return result;
  }
);

export const listUsers = api(
  { method: "GET", path: "/collaboration/users", expose: true },
  async (): Promise<{ users: User[] }> => {
    const users = await db.queryAll<User>`
      SELECT * FROM users WHERE is_active = true ORDER BY name
    `;

    return { users };
  }
);