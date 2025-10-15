import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { Comment, CreateCommentRequest } from "./types";

export const createComment = api(
  { method: "POST", path: "/collaboration/comments", expose: true },
  async (req: CreateCommentRequest): Promise<Comment> => {
    const result = await db.queryRow<Comment>`
      INSERT INTO comments (
        project_id, user_id, entity_type, entity_id,
        content, parent_id
      )
      VALUES (
        ${req.project_id},
        ${req.user_id},
        ${req.entity_type},
        ${req.entity_id},
        ${req.content},
        ${req.parent_id || null}
      )
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to create comment");
    }

    return result;
  }
);

export const listComments = api(
  { method: "GET", path: "/collaboration/comments", expose: true },
  async ({ entity_type, entity_id }: { entity_type: string; entity_id: number }): Promise<{ comments: Comment[] }> => {
    const comments = await db.queryAll<Comment>`
      SELECT 
        c.*,
        row_to_json(u.*) as user
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.entity_type = ${entity_type}
        AND c.entity_id = ${entity_id}
        AND c.parent_id IS NULL
      ORDER BY c.created_at
    `;

    return { comments };
  }
);

export const resolveComment = api(
  { method: "PATCH", path: "/collaboration/comments/:id/resolve", expose: true },
  async ({ id }: { id: number }): Promise<Comment> => {
    const result = await db.queryRow<Comment>`
      UPDATE comments
      SET is_resolved = true, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!result) {
      throw APIError.notFound("Comment not found");
    }

    return result;
  }
);