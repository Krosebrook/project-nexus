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
}

export class StateMachine<TStage extends string, TContext> {
  private stages: TStage[];
  private handlers: Record<TStage, StageHandler<TContext>>;
  private config: StateMachineConfig<TStage, TContext>;

  constructor(config: StateMachineConfig<TStage, TContext>) {
    this.stages = config.stages;
    this.handlers = config.handlers;
    this.config = config;
  }

  async execute(context: TContext): Promise<void> {
    let currentStageIndex = 0;

    try {
      for (const stage of this.stages) {
        await this.config.onStageStart?.(stage, context);
        
        const handler = this.handlers[stage];
        if (!handler) {
          throw new Error(`No handler found for stage: ${stage}`);
        }

        const result = await handler.execute(context);
        
        if (!result.success) {
          const error = new Error(result.message || `Stage ${stage} failed`);
          await this.config.onStageFailure?.(stage, error, context);
          throw error;
        }
        
        await this.config.onStageComplete?.(stage, result, context);
        currentStageIndex++;
      }
      
      await this.config.onComplete?.(context);
    } catch (error) {
      await this.config.onFailure?.(error as Error, context);
      throw error;
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
}

export function createStateMachine<TStage extends string, TContext>(
  config: StateMachineConfig<TStage, TContext>
): StateMachine<TStage, TContext> {
  return new StateMachine(config);
}