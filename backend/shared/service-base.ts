import { APIError } from "encore.dev/api";
import log from "encore.dev/log";
import { handleError, type ErrorContext } from "./errors";
import type { PaginatedResult, QueryOptions } from "./db-utils";

export interface ServiceConfig {
  serviceName: string;
  enableLogging?: boolean;
  enableMetrics?: boolean;
}

export abstract class BaseService {
  protected serviceName: string;
  protected enableLogging: boolean;
  protected enableMetrics: boolean;

  constructor(config: ServiceConfig) {
    this.serviceName = config.serviceName;
    this.enableLogging = config.enableLogging ?? true;
    this.enableMetrics = config.enableMetrics ?? true;
  }

  protected logInfo(message: string, metadata?: Record<string, any>): void {
    if (this.enableLogging) {
      log.info(`[${this.serviceName}] ${message}`, metadata);
    }
  }

  protected logError(message: string, error: unknown, metadata?: Record<string, any>): void {
    if (this.enableLogging) {
      log.error(`[${this.serviceName}] ${message}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ...metadata,
      });
    }
  }

  protected logWarning(message: string, metadata?: Record<string, any>): void {
    if (this.enableLogging) {
      log.warn(`[${this.serviceName}] ${message}`, metadata);
    }
  }

  protected handleError(error: unknown, endpoint?: string): never {
    const context: ErrorContext = {
      endpoint: endpoint || "unknown",
    };
    return handleError(error, context);
  }

  protected validateId(id: number, fieldName: string = "id"): void {
    if (!Number.isInteger(id) || id <= 0) {
      throw APIError.invalidArgument(`${fieldName} must be a positive integer`);
    }
  }

  protected validateRequired<T>(value: T | null | undefined, fieldName: string): T {
    if (value === null || value === undefined) {
      throw APIError.invalidArgument(`${fieldName} is required`);
    }
    return value;
  }

  protected validateString(value: string, fieldName: string, minLength: number = 1): string {
    if (!value || typeof value !== "string") {
      throw APIError.invalidArgument(`${fieldName} must be a string`);
    }
    if (value.trim().length < minLength) {
      throw APIError.invalidArgument(`${fieldName} must be at least ${minLength} character(s)`);
    }
    return value.trim();
  }

  protected async withErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      this.logInfo(`Starting ${operationName}`);
      const result = await operation();
      this.logInfo(`Completed ${operationName}`);
      return result;
    } catch (error) {
      this.logError(`Failed ${operationName}`, error);
      throw error;
    }
  }
}

export interface CRUDServiceConfig<TEntity, TCreateInput, TUpdateInput> extends ServiceConfig {
  repository: {
    findById(id: number): Promise<TEntity | null>;
    findAll(options?: QueryOptions): Promise<TEntity[]>;
    findPaginated(options?: QueryOptions): Promise<PaginatedResult<TEntity>>;
    count(): Promise<number>;
    deleteById(id: number): Promise<void>;
  };
  createFn?: (input: TCreateInput) => Promise<TEntity>;
  updateFn?: (id: number, input: TUpdateInput) => Promise<TEntity>;
}

export abstract class CRUDService<
  TEntity,
  TCreateInput,
  TUpdateInput
> extends BaseService {
  protected repository: CRUDServiceConfig<TEntity, TCreateInput, TUpdateInput>["repository"];
  protected createFn?: (input: TCreateInput) => Promise<TEntity>;
  protected updateFn?: (id: number, input: TUpdateInput) => Promise<TEntity>;

  constructor(config: CRUDServiceConfig<TEntity, TCreateInput, TUpdateInput>) {
    super(config);
    this.repository = config.repository;
    this.createFn = config.createFn;
    this.updateFn = config.updateFn;
  }

  async getById(id: number): Promise<TEntity> {
    this.validateId(id);
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw APIError.notFound(`${this.serviceName} not found`);
    }
    return entity;
  }

  async list(options?: QueryOptions): Promise<TEntity[]> {
    return this.repository.findAll(options);
  }

  async listPaginated(options?: QueryOptions): Promise<PaginatedResult<TEntity>> {
    return this.repository.findPaginated(options);
  }

  async count(): Promise<number> {
    return this.repository.count();
  }

  async create(input: TCreateInput): Promise<TEntity> {
    if (!this.createFn) {
      throw APIError.unimplemented("Create operation not supported");
    }
    return this.withErrorHandling(
      () => this.createFn!(input),
      "create"
    );
  }

  async update(id: number, input: TUpdateInput): Promise<TEntity> {
    if (!this.updateFn) {
      throw APIError.unimplemented("Update operation not supported");
    }
    this.validateId(id);
    await this.getById(id);
    return this.withErrorHandling(
      () => this.updateFn!(id, input),
      "update"
    );
  }

  async delete(id: number): Promise<void> {
    this.validateId(id);
    await this.getById(id);
    await this.repository.deleteById(id);
  }
}
