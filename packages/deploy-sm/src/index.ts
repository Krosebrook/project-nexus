import {
  StateMachineError,
  TransitionError,
  EffectError,
  TimeoutError,
  RetryExhaustedError,
  type State,
  type Event,
  type Transition,
  type Effect,
  type EffectResult,
  type RetryPolicy,
  type TimeoutConfig,
  type StateMetrics,
  type StateMachineMetrics,
  type SerializableState,
  type StateMachineConfig,
  type TransitionResult,
  type StateMachineHooks,
} from './types';

export * from './types';

export class StateMachine<TState extends string, TEvent extends string, TContext = any> {
  private config: StateMachineConfig<TState, TEvent, TContext>;
  private currentState: State<TState>;
  private context: TContext;
  private history: State<TState>[] = [];
  private metrics: StateMachineMetrics;
  private stateMetrics: Map<string, StateMetrics> = new Map();
  private isCancelled = false;
  private startTime: Date;
  private version = 1;

  constructor(config: StateMachineConfig<TState, TEvent, TContext>, context: TContext) {
    this.validateConfig(config);
    this.config = config;
    this.context = context;
    this.startTime = new Date();
    
    this.currentState = {
      name: config.initialState,
      data: {},
      timestamp: new Date(),
      version: this.version,
      attempts: 0,
    };

    this.metrics = {
      states: [],
      totalDurationMs: 0,
      totalAttempts: 0,
      totalErrors: 0,
      isComplete: false,
      isFailed: false,
    };
  }

  private validateConfig(config: StateMachineConfig<TState, TEvent, TContext>): void {
    if (!config.id || !config.initialState || !config.states || !config.transitions) {
      throw new Error('Invalid state machine configuration: missing required fields');
    }

    if (!config.states.includes(config.initialState)) {
      throw new Error(`Initial state "${config.initialState}" not found in states list`);
    }

    for (const transition of config.transitions) {
      const fromStates = Array.isArray(transition.from) ? transition.from : [transition.from];
      for (const from of fromStates) {
        if (!config.states.includes(from)) {
          throw new Error(`Transition source state "${from}" not found in states list`);
        }
      }
      if (!config.states.includes(transition.to)) {
        throw new Error(`Transition target state "${transition.to}" not found in states list`);
      }
      if (!config.events.includes(transition.event)) {
        throw new Error(`Transition event "${transition.event}" not found in events list`);
      }
    }
  }

  async dispatch(event: Event<TEvent>): Promise<TransitionResult<TState>> {
    if (this.isCancelled) {
      throw new StateMachineError('Cannot dispatch event: state machine is cancelled', 'CANCELLED');
    }

    await this.log('debug', `Dispatching event: ${event.type}`, { event });

    const transition = this.findTransition(this.currentState.name, event.type);
    if (!transition) {
      await this.log('warn', `No transition found for event ${event.type} in state ${this.currentState.name}`);
      return {
        success: false,
        newState: this.currentState,
        error: new TransitionError(
          `No transition found for event ${event.type} in state ${this.currentState.name}`,
          this.currentState
        ),
      };
    }

    if (transition.guard) {
      const canTransition = await transition.guard(this.context, event);
      if (!canTransition) {
        await this.log('info', `Guard blocked transition from ${this.currentState.name} to ${transition.to}`);
        return {
          success: false,
          newState: this.currentState,
          error: new TransitionError('Transition guard failed', this.currentState),
        };
      }
    }

    return await this.executeTransition(transition, event);
  }

  private findTransition(currentState: TState, eventType: TEvent): Transition<TState, TEvent, TContext> | null {
    return this.config.transitions.find(t => {
      const fromStates = Array.isArray(t.from) ? t.from : [t.from];
      return fromStates.includes(currentState) && t.event === eventType;
    }) || null;
  }

  private async executeTransition(
    transition: Transition<TState, TEvent, TContext>,
    event: Event<TEvent>
  ): Promise<TransitionResult<TState>> {
    const oldState = this.currentState;
    const newStateName = transition.to;

    try {
      await this.recordStateExit(oldState);
      await this.config.hooks?.onStateExit?.(oldState, this.context);

      const newState: State<TState> = {
        name: newStateName,
        data: {},
        timestamp: new Date(),
        version: ++this.version,
        attempts: 0,
      };

      await this.config.hooks?.onTransition?.(oldState, newState, event, this.context);

      let effectResult: EffectResult | undefined;
      const effect = transition.effect || this.config.effects?.get(newStateName);
      
      if (effect) {
        effectResult = await this.executeEffectWithRetry(effect, newState);
        if (!effectResult.success) {
          throw new EffectError(
            effectResult.message || 'Effect execution failed',
            newState,
            effectResult.metadata?.error
          );
        }
      }

      this.history.push(oldState);
      this.currentState = newState;

      await this.recordStateEntry(newState);
      await this.config.hooks?.onStateEnter?.(newState, this.context);
      await this.persistIfConfigured();

      await this.log('info', `Transitioned from ${oldState.name} to ${newState.name}`, {
        event: event.type,
        effectResult,
      });

      return {
        success: true,
        newState,
        effectResult,
      };
    } catch (error) {
      const err = error as Error;
      this.metrics.totalErrors++;
      await this.config.hooks?.onError?.(err, oldState, this.context);
      await this.log('error', `Transition failed: ${err.message}`, { error: err });

      return {
        success: false,
        newState: oldState,
        error: err,
      };
    }
  }

  private async executeEffectWithRetry(effect: Effect<TContext>, state: State<TState>): Promise<EffectResult> {
    const retryPolicy = this.config.retryPolicy;
    const maxAttempts = retryPolicy?.maxAttempts ?? 1;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        state.attempts = attempt;
        this.metrics.totalAttempts++;

        const timeout = this.config.timeout?.effectTimeout;
        const result = timeout
          ? await this.withTimeout(effect.execute(this.context, state), timeout)
          : await effect.execute(this.context, state);

        if (result.success) {
          return result;
        }

        if (result.canRetry === false || attempt >= maxAttempts) {
          return result;
        }

        lastError = result.metadata?.error;
      } catch (error) {
        lastError = error as Error;
        
        const shouldRetry = retryPolicy?.shouldRetry?.(lastError, attempt) ?? true;
        if (!shouldRetry || attempt >= maxAttempts) {
          if (!effect.isIdempotent && effect.rollback) {
            await effect.rollback(this.context, state);
          }
          throw new RetryExhaustedError(
            `Effect failed after ${attempt} attempts: ${lastError.message}`,
            attempt,
            state,
            lastError
          );
        }

        await this.config.hooks?.onRetry?.(attempt, lastError, state, this.context);
        await this.log('warn', `Retrying effect (attempt ${attempt}/${maxAttempts})`, { error: lastError });

        const delay = this.calculateRetryDelay(attempt, retryPolicy);
        await this.sleep(delay);
      }
    }

    throw new RetryExhaustedError(
      `Effect failed after ${maxAttempts} attempts`,
      maxAttempts,
      state,
      lastError
    );
  }

  private calculateRetryDelay(attempt: number, policy?: RetryPolicy): number {
    if (!policy) return 1000;

    const baseDelay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(baseDelay, policy.maxDelayMs);
    const jitter = cappedDelay * policy.jitterFactor * (Math.random() - 0.5);
    
    return Math.max(0, cappedDelay + jitter);
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`, this.currentState)), timeoutMs)
      ),
    ]);
  }

  private async recordStateEntry(state: State<TState>): Promise<void> {
    const metric: StateMetrics = {
      state: state.name,
      enteredAt: new Date(),
      attempts: state.attempts || 0,
      errors: 0,
    };
    this.stateMetrics.set(state.name, metric);
    await this.config.hooks?.onMetric?.(metric);
  }

  private async recordStateExit(state: State<TState>): Promise<void> {
    const metric = this.stateMetrics.get(state.name);
    if (metric) {
      metric.exitedAt = new Date();
      metric.durationMs = metric.exitedAt.getTime() - metric.enteredAt.getTime();
      this.metrics.states.push(metric);
      await this.config.hooks?.onMetric?.(metric);
    }
  }

  async cancel(): Promise<void> {
    this.isCancelled = true;
    await this.config.hooks?.onCancel?.(this.currentState, this.context);
    await this.log('info', 'State machine cancelled');
  }

  async complete(): Promise<void> {
    await this.recordStateExit(this.currentState);
    this.metrics.isComplete = true;
    this.metrics.totalDurationMs = new Date().getTime() - this.startTime.getTime();
    await this.config.hooks?.onComplete?.(this.currentState, this.context, this.metrics);
    await this.log('info', 'State machine completed', { metrics: this.metrics });
  }

  async fail(error: Error): Promise<void> {
    this.metrics.isFailed = true;
    this.metrics.totalErrors++;
    this.metrics.totalDurationMs = new Date().getTime() - this.startTime.getTime();
    await this.config.hooks?.onError?.(error, this.currentState, this.context);
    await this.log('error', 'State machine failed', { error });
  }

  getState(): State<TState> {
    return { ...this.currentState };
  }

  getContext(): TContext {
    return this.context;
  }

  updateContext(updater: (ctx: TContext) => TContext): void {
    this.context = updater(this.context);
  }

  getHistory(): State<TState>[] {
    return [...this.history];
  }

  getMetrics(): StateMachineMetrics {
    return { ...this.metrics };
  }

  async serialize(): Promise<SerializableState<TContext>> {
    return {
      currentState: this.currentState,
      context: this.context,
      history: this.history,
      metrics: this.metrics,
      version: this.version,
    };
  }

  async rehydrate(serialized: SerializableState<TContext>): Promise<void> {
    this.currentState = serialized.currentState as State<TState>;
    this.context = serialized.context;
    this.history = serialized.history as State<TState>[];
    this.metrics = serialized.metrics;
    this.version = serialized.version;
    await this.log('info', 'State machine rehydrated', { state: this.currentState.name });
  }

  private async persistIfConfigured(): Promise<void> {
    if (this.config.persistState) {
      const serialized = await this.serialize();
      await this.config.persistState(serialized);
    }
  }

  private async log(level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: any): Promise<void> {
    await this.config.hooks?.onLog?.(level, message, metadata);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function createStateMachine<TState extends string, TEvent extends string, TContext = any>(
  config: StateMachineConfig<TState, TEvent, TContext>,
  context: TContext
): StateMachine<TState, TEvent, TContext> {
  return new StateMachine(config, context);
}

export class EffectBuilder<TContext = any> {
  private executeFn?: (context: TContext, state: State) => Promise<EffectResult>;
  private rollbackFn?: (context: TContext, state: State) => Promise<void>;
  private idempotent = false;

  execute(fn: (context: TContext, state: State) => Promise<EffectResult>): this {
    this.executeFn = fn;
    return this;
  }

  rollback(fn: (context: TContext, state: State) => Promise<void>): this {
    this.rollbackFn = fn;
    return this;
  }

  setIdempotent(value: boolean): this {
    this.idempotent = value;
    return this;
  }

  build(): Effect<TContext> {
    if (!this.executeFn) {
      throw new Error('Effect must have an execute function');
    }

    return {
      execute: this.executeFn,
      rollback: this.rollbackFn,
      isIdempotent: this.idempotent,
    };
  }
}

export function effect<TContext = any>(): EffectBuilder<TContext> {
  return new EffectBuilder<TContext>();
}

export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};
