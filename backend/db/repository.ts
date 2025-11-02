import { APIError } from "encore.dev/api";
import db from "./index";
import { createQueryBuilder, validateEntityExists, validateUniqueName } from "../shared/db-utils";
import type { PaginatedResult, QueryOptions } from "../shared/db-utils";

export abstract class BaseRepository<T> {
  constructor(protected tableName: string, protected entityName: string) {}

  protected query() {
    return createQueryBuilder(this.tableName);
  }

  async findById(id: number): Promise<T | null> {
    const result = await this.query()
      .where("id", "=", id)
      .executeOne<T>();
    return result;
  }

  async findByIdOrThrow(id: number): Promise<T> {
    const result = await this.findById(id);
    if (!result) {
      throw APIError.notFound(`${this.entityName} not found`);
    }
    return result;
  }

  async exists(id: number): Promise<boolean> {
    await validateEntityExists(this.tableName, id, this.entityName);
    return true;
  }

  async findAll(options?: QueryOptions): Promise<T[]> {
    const query = this.query();
    
    if (options?.orderBy) {
      query.orderBy(options.orderBy, options.orderDirection);
    }
    
    if (options?.limit) {
      query.limit(options.limit);
    }
    
    if (options?.offset) {
      query.offset(options.offset);
    }
    
    return query.execute<T>();
  }

  async findPaginated(options?: QueryOptions): Promise<PaginatedResult<T>> {
    const query = this.query();
    
    if (options?.orderBy) {
      query.orderBy(options.orderBy, options.orderDirection);
    }
    
    if (options?.limit) {
      query.limit(options.limit);
    }
    
    if (options?.offset) {
      query.offset(options.offset);
    }
    
    return query.paginate<T>();
  }

  async count(): Promise<number> {
    return this.query().count();
  }

  async deleteById(id: number): Promise<void> {
    await this.exists(id);
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
    await db.rawQueryRow(query, id);
  }

  async softDelete(id: number): Promise<void> {
    await this.exists(id);
    const query = `UPDATE ${this.tableName} SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`;
    await db.rawQueryRow(query, id);
  }
}

export class ProjectRepository extends BaseRepository<any> {
  constructor() {
    super("projects", "Project");
  }

  async findByName(name: string): Promise<any | null> {
    return this.query()
      .where("name", "=", name)
      .executeOne();
  }

  async validateUniqueName(name: string, excludeId?: number): Promise<void> {
    await validateUniqueName(this.tableName, name, "Project with this name already exists", excludeId);
  }

  async findByStatus(status: string): Promise<any[]> {
    return this.query()
      .where("status", "=", status)
      .orderBy("created_at", "DESC")
      .execute();
  }
}

export class DeploymentRepository extends BaseRepository<any> {
  constructor() {
    super("deployments", "Deployment");
  }

  async findByProject(projectId: number, options?: QueryOptions): Promise<any[]> {
    const query = this.query().where("project_id", "=", projectId);
    
    if (options?.orderBy) {
      query.orderBy(options.orderBy, options.orderDirection);
    } else {
      query.orderBy("created_at", "DESC");
    }
    
    if (options?.limit) {
      query.limit(options.limit);
    }
    
    return query.execute();
  }

  async findByEnvironment(environmentId: number): Promise<any[]> {
    return this.query()
      .where("environment_id", "=", environmentId)
      .orderBy("created_at", "DESC")
      .execute();
  }

  async findByStatus(status: string): Promise<any[]> {
    return this.query()
      .where("status", "=", status)
      .orderBy("created_at", "DESC")
      .execute();
  }
}

export class AlertRuleRepository extends BaseRepository<any> {
  constructor() {
    super("alert_rules", "Alert rule");
  }

  async findByProject(projectId: number): Promise<any[]> {
    return this.query()
      .where("project_id", "=", projectId)
      .orderBy("created_at", "DESC")
      .execute();
  }

  async findEnabled(): Promise<any[]> {
    return this.query()
      .where("enabled", "=", true)
      .execute();
  }

  async toggleEnabled(id: number, enabled: boolean): Promise<void> {
    await this.exists(id);
    const query = `UPDATE alert_rules SET enabled = $1, updated_at = NOW() WHERE id = $2`;
    await db.rawQueryRow(query, enabled, id);
  }
}

export class TestCaseRepository extends BaseRepository<any> {
  constructor() {
    super("test_cases", "Test case");
  }

  async findByProject(projectId: number): Promise<any[]> {
    return this.query()
      .where("project_id", "=", projectId)
      .orderBy("created_at", "DESC")
      .execute();
  }

  async findByStatus(projectId: number, status: string): Promise<any[]> {
    return this.query()
      .where("project_id", "=", projectId)
      .where("status", "=", status)
      .execute();
  }
}

export class BackupRepository extends BaseRepository<any> {
  constructor() {
    super("backups", "Backup");
  }

  async findByType(backupType: string): Promise<any[]> {
    return this.query()
      .where("backup_type", "=", backupType)
      .orderBy("created_at", "DESC")
      .execute();
  }

  async findRecent(limit: number = 10): Promise<any[]> {
    return this.query()
      .orderBy("created_at", "DESC")
      .limit(limit)
      .execute();
  }
}

export class CommentRepository extends BaseRepository<any> {
  constructor() {
    super("comments", "Comment");
  }

  async findByEntity(entityType: string, entityId: number): Promise<any[]> {
    return this.query()
      .where("entity_type", "=", entityType)
      .where("entity_id", "=", entityId)
      .orderBy("created_at", "DESC")
      .execute();
  }

  async findByProject(projectId: number): Promise<any[]> {
    return this.query()
      .where("project_id", "=", projectId)
      .orderBy("created_at", "DESC")
      .execute();
  }
}

export const repositories = {
  projects: new ProjectRepository(),
  deployments: new DeploymentRepository(),
  alertRules: new AlertRuleRepository(),
  testCases: new TestCaseRepository(),
  backups: new BackupRepository(),
  comments: new CommentRepository(),
};
