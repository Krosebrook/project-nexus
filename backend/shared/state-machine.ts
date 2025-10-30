export type StateTransitionType = 'forward' | 'rollback' | 'skip';

export interface StageResult<T = any> {
  success: boolean;
  message?: string;
  metadata?: T;
}

export interface StageHandler<TContext, TMetadata = any> {
  execute(context: TContext): Promise<StageResult<TMetadata>>;
}

export interface StateMachineEvent<TStage extends string, TContext> {
  type: 'transition' | 'stage_start' | 'stage_complete' | 'stage_failure' | 'rollback' | 'complete' | 'failure';
  timestamp: Date;
  stage?: TStage;
  previousStage?: TStage;
  nextStage?: TStage;
  transitionType?: StateTransitionType;
  context?: TContext;
  error?: Error;
  metadata?: any;
}

export interface StateMachinePersistence<TStage extends string, TContext> {
  saveState(machineId: string, currentStage: TStage, context: TContext): Promise<void>;
  loadState(machineId: string): Promise<{ currentStage: TStage; context: TContext } | null>;
  deleteState(machineId: string): Promise<void>;
}

export interface StateMachineConfig<TStage extends string, TContext> {
  stages: TStage[];
  handlers: Record<TStage, StageHandler<TContext>>;
  onStageStart?: (stage: TStage, context: TContext) => Promise<void>;
  onStageComplete?: (stage: TStage, result: StageResult, context: TContext) => Promise<void>;
  onStageFailure?: (stage: TStage, error: Error, context: TContext) => Promise<void>;
  onComplete?: (context: TContext) => Promise<void>;
  onFailure?: (error: Error, context: TContext) => Promise<void>;
  retryStrategy?: RetryStrategy<TStage>;
  skipStages?: TStage[];
  persistence?: StateMachinePersistence<TStage, TContext>;
  machineId?: string;
  eventEmitter?: (event: StateMachineEvent<TStage, TContext>) => Promise<void>;
  rollbackHandlers?: Partial<Record<TStage, StageHandler<TContext>>>;
}

export interface RetryStrategy<TStage extends string> {
  maxRetries?: number;
  retryableStages?: TStage[];
  shouldRetry?: (stage: TStage, error: Error, attempt: number) => boolean;
  onRetry?: (stage: TStage, attempt: number, error: Error) => Promise<void>;
}

export class StateMachine<TStage extends string, TContext> {
  private stages: TStage[];
  private handlers: Record<TStage, StageHandler<TContext>>;
  private config: StateMachineConfig<TStage, TContext>;
  private stageRetries: Map<TStage, number> = new Map();
  private currentStage: TStage | null = null;
  private stageHistory: TStage[] = [];
  private eventListeners: Array<(event: StateMachineEvent<TStage, TContext>) => void> = [];

  constructor(config: StateMachineConfig<TStage, TContext>) {
    this.stages = config.skipStages 
      ? config.stages.filter(s => !config.skipStages!.includes(s))
      : config.stages;
    this.handlers = config.handlers;
    this.config = config;
  }

  on(listener: (event: StateMachineEvent<TStage, TContext>) => void): void {
    this.eventListeners.push(listener);
  }

  off(listener: (event: StateMachineEvent<TStage, TContext>) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private async emitEvent(event: StateMachineEvent<TStage, TContext>): Promise<void> {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
      }
    }

    if (this.config.eventEmitter) {
      await this.config.eventEmitter(event);
    }
  }

  async execute(context: TContext): Promise<void> {
    let currentStageIndex = 0;
    let startStageIndex = 0;

    if (this.config.persistence && this.config.machineId) {
      const savedState = await this.config.persistence.loadState(this.config.machineId);
      if (savedState) {
        currentStageIndex = this.stages.indexOf(savedState.currentStage);
        if (currentStageIndex > 0) {
          startStageIndex = currentStageIndex;
          Object.assign(context as any, savedState.context);
        }
      }
    }

    try {
      for (let i = startStageIndex; i < this.stages.length; i++) {
        const stage = this.stages[i];
        const previousStage = this.currentStage;
        this.currentStage = stage;
        
        await this.emitEvent({
          type: 'transition',
          timestamp: new Date(),
          stage,
          previousStage: previousStage || undefined,
          nextStage: stage,
          transitionType: 'forward',
          context
        });

        await this.executeStageWithRetry(stage, context);
        this.stageHistory.push(stage);
        
        if (this.config.persistence && this.config.machineId) {
          await this.config.persistence.saveState(this.config.machineId, stage, context as any);
        }

        currentStageIndex++;
      }
      
      await this.emitEvent({
        type: 'complete',
        timestamp: new Date(),
        context
      });

      await this.config.onComplete?.(context);

      if (this.config.persistence && this.config.machineId) {
        await this.config.persistence.deleteState(this.config.machineId);
      }
    } catch (error) {
      await this.emitEvent({
        type: 'failure',
        timestamp: new Date(),
        stage: this.currentStage || undefined,
        error: error as Error,
        context
      });

      await this.config.onFailure?.(error as Error, context);
      throw error;
    }
  }

  async rollback(context: TContext, toStage?: TStage): Promise<void> {
    if (!this.config.rollbackHandlers) {
      throw new Error('Rollback handlers not configured');
    }

    const targetStageIndex = toStage 
      ? this.stages.indexOf(toStage)
      : -1;

    for (let i = this.stageHistory.length - 1; i >= 0; i--) {
      const stage = this.stageHistory[i];
      
      if (targetStageIndex >= 0 && this.stages.indexOf(stage) <= targetStageIndex) {
        break;
      }

      const rollbackHandler = this.config.rollbackHandlers[stage];
      if (rollbackHandler) {
        await this.emitEvent({
          type: 'rollback',
          timestamp: new Date(),
          stage,
          transitionType: 'rollback',
          context
        });

        try {
          await rollbackHandler.execute(context);
        } catch (error) {
          await this.emitEvent({
            type: 'stage_failure',
            timestamp: new Date(),
            stage,
            error: error as Error,
            context
          });
          throw new Error(`Rollback failed at stage ${stage}: ${error}`);
        }
      }
    }

    if (this.config.persistence && this.config.machineId) {
      if (toStage) {
        await this.config.persistence.saveState(this.config.machineId, toStage, context);
      } else {
        await this.config.persistence.deleteState(this.config.machineId);
      }
    }
  }

  private async executeStageWithRetry(stage: TStage, context: TContext): Promise<void> {
    const maxRetries = this.config.retryStrategy?.maxRetries || 0;
    const retryableStages = this.config.retryStrategy?.retryableStages || [];
    const isRetryable = retryableStages.includes(stage);

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= (isRetryable ? maxRetries : 0)) {
      try {
        await this.emitEvent({
          type: 'stage_start',
          timestamp: new Date(),
          stage,
          context
        });

        await this.config.onStageStart?.(stage, context);
        
        const handler = this.handlers[stage];
        if (!handler) {
          throw new Error(`No handler found for stage: ${stage}`);
        }

        const result = await handler.execute(context);
        
        if (!result.success) {
          const error = new Error(result.message || `Stage ${stage} failed`);
          throw error;
        }

        await this.emitEvent({
          type: 'stage_complete',
          timestamp: new Date(),
          stage,
          context,
          metadata: result.metadata
        });
        
        await this.config.onStageComplete?.(stage, result, context);
        this.stageRetries.set(stage, attempt);
        return;
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt > maxRetries || !isRetryable) {
          await this.emitEvent({
            type: 'stage_failure',
            timestamp: new Date(),
            stage,
            error: lastError,
            context
          });

          await this.config.onStageFailure?.(stage, lastError, context);
          throw lastError;
        }

        const shouldRetry = this.config.retryStrategy?.shouldRetry?.(stage, lastError, attempt) ?? true;
        if (!shouldRetry) {
          await this.emitEvent({
            type: 'stage_failure',
            timestamp: new Date(),
            stage,
            error: lastError,
            context
          });

          await this.config.onStageFailure?.(stage, lastError, context);
          throw lastError;
        }

        await this.config.retryStrategy?.onRetry?.(stage, attempt, lastError);
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 10000)));
      }
    }

    if (lastError) {
      await this.emitEvent({
        type: 'stage_failure',
        timestamp: new Date(),
        stage,
        error: lastError,
        context
      });

      await this.config.onStageFailure?.(stage, lastError, context);
      throw lastError;
    }
  }

  async executeStage(stage: TStage, context: TContext): Promise<StageResult> {
    const handler = this.handlers[stage];
    if (!handler) {
      throw new Error(`No handler found for stage: ${stage}`);
    }
    return await handler.execute(context);
  }

  getStages(): TStage[] {
    return [...this.stages];
  }

  getCurrentStageIndex(stage: TStage): number {
    return this.stages.indexOf(stage);
  }

  getProgress(currentStage: TStage): number {
    const index = this.getCurrentStageIndex(currentStage);
    if (index === -1) return 0;
    return Math.round(((index + 1) / this.stages.length) * 100);
  }

  getRetryCount(stage: TStage): number {
    return this.stageRetries.get(stage) || 0;
  }

  getTotalRetries(): number {
    let total = 0;
    for (const count of this.stageRetries.values()) {
      total += count;
    }
    return total;
  }

  canSkipStage(stage: TStage): boolean {
    return this.config.skipStages?.includes(stage) || false;
  }

  getCurrentStage(): TStage | null {
    return this.currentStage;
  }

  getStageHistory(): TStage[] {
    return [...this.stageHistory];
  }

  getNextStage(currentStage: TStage): TStage | null {
    const index = this.stages.indexOf(currentStage);
    if (index === -1 || index === this.stages.length - 1) {
      return null;
    }
    return this.stages[index + 1];
  }

  getPreviousStage(currentStage: TStage): TStage | null {
    const index = this.stages.indexOf(currentStage);
    if (index <= 0) {
      return null;
    }
    return this.stages[index - 1];
  }
}

export class DatabaseStateMachinePersistence<TStage extends string, TContext> implements StateMachinePersistence<TStage, TContext> {
  constructor(
    private tableName: string,
    private db: any
  ) {}

  async saveState(machineId: string, currentStage: TStage, context: TContext): Promise<void> {
    await this.db.exec`
      INSERT INTO ${this.db.raw(this.tableName)} (machine_id, current_stage, context, updated_at)
      VALUES (${machineId}, ${currentStage}, ${JSON.stringify(context)}, NOW())
      ON CONFLICT (machine_id) 
      DO UPDATE SET current_stage = ${currentStage}, context = ${JSON.stringify(context)}, updated_at = NOW()
    `;
  }

  async loadState(machineId: string): Promise<{ currentStage: TStage; context: TContext } | null> {
    const result = await this.db.queryRow<{ current_stage: TStage; context: string }>`
      SELECT current_stage, context 
      FROM ${this.db.raw(this.tableName)}
      WHERE machine_id = ${machineId}
    `;

    if (!result) {
      return null;
    }

    return {
      currentStage: result.current_stage,
      context: JSON.parse(result.context) as TContext
    };
  }

  async deleteState(machineId: string): Promise<void> {
    await this.db.exec`
      DELETE FROM ${this.db.raw(this.tableName)}
      WHERE machine_id = ${machineId}
    `;
  }
}

export function createStateMachine<TStage extends string, TContext>(
  config: StateMachineConfig<TStage, TContext>
): StateMachine<TStage, TContext> {
  return new StateMachine(config);
}