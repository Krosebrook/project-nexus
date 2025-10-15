export interface StageResult<T = any> {
  success: boolean;
  message?: string;
  metadata?: T;
}

export interface StageHandler<TContext, TMetadata = any> {
  execute(context: TContext): Promise<StageResult<TMetadata>>;
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

  constructor(config: StateMachineConfig<TStage, TContext>) {
    this.stages = config.skipStages 
      ? config.stages.filter(s => !config.skipStages!.includes(s))
      : config.stages;
    this.handlers = config.handlers;
    this.config = config;
  }

  async execute(context: TContext): Promise<void> {
    let currentStageIndex = 0;

    try {
      for (const stage of this.stages) {
        await this.executeStageWithRetry(stage, context);
        currentStageIndex++;
      }
      
      await this.config.onComplete?.(context);
    } catch (error) {
      await this.config.onFailure?.(error as Error, context);
      throw error;
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
        
        await this.config.onStageComplete?.(stage, result, context);
        this.stageRetries.set(stage, attempt);
        return;
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt > maxRetries || !isRetryable) {
          await this.config.onStageFailure?.(stage, lastError, context);
          throw lastError;
        }

        const shouldRetry = this.config.retryStrategy?.shouldRetry?.(stage, lastError, attempt) ?? true;
        if (!shouldRetry) {
          await this.config.onStageFailure?.(stage, lastError, context);
          throw lastError;
        }

        await this.config.retryStrategy?.onRetry?.(stage, attempt, lastError);
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 10000)));
      }
    }

    if (lastError) {
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
}

export function createStateMachine<TStage extends string, TContext>(
  config: StateMachineConfig<TStage, TContext>
): StateMachine<TStage, TContext> {
  return new StateMachine(config);
}