import { APIError } from "encore.dev/api";
import db from "../db/index";

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
}

export interface WhereCondition {
  field: string;
  operator?: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "IN" | "IS NULL" | "IS NOT NULL";
  value?: any;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export class QueryBuilder {
  private table: string;
  private selectColumns: string[] = ["*"];
  private whereConditions: WhereCondition[] = [];
  private queryOptions: QueryOptions = {};
  private params: any[] = [];
  private paramIndex = 1;

  constructor(table: string) {
    this.table = table;
  }

  select(...columns: string[]): this {
    this.selectColumns = columns;
    return this;
  }

  where(field: string, operator: WhereCondition["operator"], value?: any): this {
    this.whereConditions.push({ field, operator, value });
    return this;
  }

  orderBy(field: string, direction: "ASC" | "DESC" = "ASC"): this {
    this.queryOptions.orderBy = field;
    this.queryOptions.orderDirection = direction;
    return this;
  }

  limit(limit: number): this {
    this.queryOptions.limit = limit;
    return this;
  }

  offset(offset: number): this {
    this.queryOptions.offset = offset;
    return this;
  }

  private buildWhereClause(): string {
    if (this.whereConditions.length === 0) return "";

    const conditions = this.whereConditions.map((condition) => {
      const { field, operator = "=", value } = condition;
      
      if (operator === "IS NULL" || operator === "IS NOT NULL") {
        return `${field} ${operator}`;
      }
      
      if (operator === "IN" && Array.isArray(value)) {
        const placeholders = value.map(() => `$${this.paramIndex++}`).join(", ");
        this.params.push(...value);
        return `${field} IN (${placeholders})`;
      }
      
      this.params.push(value);
      return `${field} ${operator} $${this.paramIndex++}`;
    });

    return ` WHERE ${conditions.join(" AND ")}`;
  }

  buildQuery(): { query: string; params: any[] } {
    let query = `SELECT ${this.selectColumns.join(", ")} FROM ${this.table}`;
    
    query += this.buildWhereClause();

    if (this.queryOptions.orderBy) {
      const direction = this.queryOptions.orderDirection || "ASC";
      query += ` ORDER BY ${this.queryOptions.orderBy} ${direction}`;
    }

    if (this.queryOptions.limit !== undefined) {
      query += ` LIMIT $${this.paramIndex++}`;
      this.params.push(this.queryOptions.limit);
    }

    if (this.queryOptions.offset !== undefined) {
      query += ` OFFSET $${this.paramIndex++}`;
      this.params.push(this.queryOptions.offset);
    }

    return { query, params: this.params };
  }

  async execute<T>(): Promise<T[]> {
    const { query, params } = this.buildQuery();
    return db.rawQueryAll(query, ...params) as Promise<T[]>;
  }

  async executeOne<T>(): Promise<T | null> {
    const { query, params } = this.buildQuery();
    return db.rawQueryRow(query, ...params) as Promise<T | null>;
  }

  async count(): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${this.table}`;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (this.whereConditions.length > 0) {
      const conditions = this.whereConditions.map((condition) => {
        const { field, operator = "=", value } = condition;
        
        if (operator === "IS NULL" || operator === "IS NOT NULL") {
          return `${field} ${operator}`;
        }
        
        if (operator === "IN" && Array.isArray(value)) {
          const placeholders = value.map(() => `$${countParamIndex++}`).join(", ");
          countParams.push(...value);
          return `${field} IN (${placeholders})`;
        }
        
        countParams.push(value);
        return `${field} ${operator} $${countParamIndex++}`;
      });
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    const result = await db.rawQueryRow(query, ...countParams);
    return Number(result?.count || 0);
  }

  async paginate<T>(): Promise<PaginatedResult<T>> {
    const limit = this.queryOptions.limit || 50;
    const offset = this.queryOptions.offset || 0;

    const [items, total] = await Promise.all([
      this.execute<T>(),
      this.count(),
    ]);

    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }
}

export async function validateEntityExists(
  table: string,
  id: number,
  entityName: string = "Entity"
): Promise<void> {
  const query = `SELECT EXISTS(SELECT 1 FROM ${table} WHERE id = $1)`;
  const result = await db.rawQueryAll(query, id);
  if (!result[0]?.exists) {
    throw APIError.notFound(`${entityName} not found`);
  }
}

export async function validateUniqueName(
  table: string,
  name: string,
  errorMessage?: string,
  excludeId?: number
): Promise<void> {
  const builder = new QueryBuilder(table)
    .select("id")
    .where("name", "=", name);
  
  if (excludeId) {
    builder.where("id", "!=", excludeId);
  }

  const existing = await builder.executeOne();
  
  if (existing) {
    throw APIError.alreadyExists(errorMessage || `${table.slice(0, -1)} with this name already exists`);
  }
}

export async function softDelete(table: string, id: number): Promise<void> {
  const query = `UPDATE ${table} SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`;
  await db.rawQueryRow(query, id);
}

export async function hardDelete(table: string, id: number): Promise<void> {
  const query = `DELETE FROM ${table} WHERE id = $1`;
  await db.rawQueryRow(query, id);
}

export async function batchInsert<T extends Record<string, any>>(
  table: string,
  records: T[],
  returningColumns?: string[]
): Promise<any[]> {
  if (records.length === 0) return [];

  const columns = Object.keys(records[0]);
  const values = records.map((record, rowIndex) => {
    return columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(", ");
  });

  const params = records.flatMap((record) => columns.map((col) => record[col]));
  
  let query = `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${values.map(v => `(${v})`).join(", ")}`;
  
  if (returningColumns && returningColumns.length > 0) {
    query += ` RETURNING ${returningColumns.join(", ")}`;
  }

  return db.rawQueryAll(query, ...params);
}

export async function upsert<T extends Record<string, any>>(
  table: string,
  record: T,
  conflictColumns: string[],
  updateColumns: string[]
): Promise<any> {
  const columns = Object.keys(record);
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const params = columns.map((col) => record[col]);

  const updateSet = updateColumns.map((col) => `${col} = EXCLUDED.${col}`).join(", ");

  const query = `
    INSERT INTO ${table} (${columns.join(", ")})
    VALUES (${placeholders.join(", ")})
    ON CONFLICT (${conflictColumns.join(", ")})
    DO UPDATE SET ${updateSet}
    RETURNING *
  `;

  return db.rawQueryRow(query, ...params);
}

export function createQueryBuilder(table: string): QueryBuilder {
  return new QueryBuilder(table);
}
