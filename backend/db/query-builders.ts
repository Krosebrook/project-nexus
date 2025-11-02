import db from "./index";

export interface ListQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
}

export interface WhereClause {
  field: string;
  operator?: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "IN";
  value: any;
}

export async function buildListQuery<T>(
  table: string,
  columns: string[],
  options: ListQueryOptions = {},
  where?: WhereClause[]
): Promise<T[]> {
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  const orderBy = options.orderBy || "created_at";
  const orderDirection = options.orderDirection || "DESC";

  let query = `SELECT ${columns.join(", ")} FROM ${table}`;
  const params: any[] = [];
  let paramIndex = 1;

  if (where && where.length > 0) {
    const conditions = where.map((w) => {
      const op = w.operator || "=";
      if (op === "IN" && Array.isArray(w.value)) {
        const placeholders = w.value.map(() => `$${paramIndex++}`).join(", ");
        params.push(...w.value);
        return `${w.field} IN (${placeholders})`;
      } else {
        params.push(w.value);
        return `${w.field} ${op} $${paramIndex++}`;
      }
    });
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` ORDER BY ${orderBy} ${orderDirection}`;
  query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(limit, offset);

  return db.rawQueryAll(query, ...params) as Promise<T[]>;
}

export async function getCount(
  table: string,
  where?: WhereClause[]
): Promise<number> {
  let query = `SELECT COUNT(*) as count FROM ${table}`;
  const params: any[] = [];
  let paramIndex = 1;

  if (where && where.length > 0) {
    const conditions = where.map((w) => {
      const op = w.operator || "=";
      if (op === "IN" && Array.isArray(w.value)) {
        const placeholders = w.value.map(() => `$${paramIndex++}`).join(", ");
        params.push(...w.value);
        return `${w.field} IN (${placeholders})`;
      } else {
        params.push(w.value);
        return `${w.field} ${op} $${paramIndex++}`;
      }
    });
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  const result = await db.rawQueryRow(query, ...params);
  return Number(result?.count || 0);
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export async function paginatedQuery<T>(
  table: string,
  columns: string[],
  options: ListQueryOptions = {},
  where?: WhereClause[]
): Promise<PaginatedResult<T>> {
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  const [items, total] = await Promise.all([
    buildListQuery<T>(table, columns, options, where),
    getCount(table, where),
  ]);

  return {
    items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}
