export interface State<TName extends string = string, TData = any> {
  name: TName;
  data: TData;
  timestamp: Date;
  version: number;
  attempts?: number;
}

export interface Event<TType extends string = string, TPayload = any> {
  type: TType;
  payload?: TPayload;
  timestamp: Date;
  correlationId?: string;
}

export interface Transition<TState extends string, TEvent extends string, TContext = any> {
  from: TState | TState[];
  to: TState;
  event: TEvent;
  guard?: (context: TContext, event: Event<TEvent>) => boolean | Promise<boolean>;
  effect?: Effect<TContext>;
}

export interface Effect<TContext = any> {
  execute(context: TContext, state: State): Promise<EffectResult>;
  rollback?(context: TContext, state: State): Promise<void>;
  isIdempotent?: boolean;
}

export interface EffectResult {
  success: boolean;
  message?: string;
  metadata?: Record<string, any>;
  canRetry?: boolean;
}

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
  retryableErrors?: Array<new (...args: any[]) => Error>;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export interface TimeoutConfig {
  stateTimeout?: number;
  transitionTimeout?: number;
  effectTimeout?: number;
}

export interface StateMetrics {
  state: string;
  enteredAt: Date;
  exitedAt?: Date;
  durationMs?: number;
  attempts: number;
  errors: number;
}

export interface StateMachineMetrics {
  states: StateMetrics[];
  totalDurationMs: number;
  totalAttempts: number;
  totalErrors: number;
  isComplete: boolean;
  isFailed: boolean;
}

export interface SerializableState<TContext = any> {
  currentState: State;
  context: TContext;
  history: State[];
  metrics: StateMachineMetrics;
  version: number;
}

export interface StateMachineHooks<TState extends string, TEvent extends string, TContext = any> {
  onStateEnter?: (state: State<TState>, context: TContext) => Promise<void>;
  onStateExit?: (state: State<TState>, context: TContext) => Promise<void>;
  onTransition?: (from: State<TState>, to: State<TState>, event: Event<TEvent>, context: TContext) => Promise<void>;
  onError?: (error: Error, state: State<TState>, context: TContext) => Promise<void>;
  onRetry?: (attempt: number, error: Error, state: State<TState>, context: TContext) => Promise<void>;
  onComplete?: (finalState: State<TState>, context: TContext, metrics: StateMachineMetrics) => Promise<void>;
  onCancel?: (state: State<TState>, context: TContext) => Promise<void>;
  onMetric?: (metric: StateMetrics) => Promise<void>;
  onLog?: (level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: any) => Promise<void>;
}

export interface StateMachineConfig<TState extends string, TEvent extends string, TContext = any> {
  id: string;
  initialState: TState;
  states: TState[];
  events: TEvent[];
  transitions: Transition<TState, TEvent, TContext>[];
  effects?: Map<TState, Effect<TContext>>;
  retryPolicy?: RetryPolicy;
  timeout?: TimeoutConfig;
  hooks?: StateMachineHooks<TState, TEvent, TContext>;
  persistState?: (state: SerializableState<TContext>) => Promise<void>;
  loadState?: () => Promise<SerializableState<TContext> | null>;
}

export interface TransitionResult<TState extends string> {
  success: boolean;
  newState: State<TState>;
  error?: Error;
  effectResult?: EffectResult;
}

export class StateMachineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly state?: State,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'StateMachineError';
  }
}

export class TransitionError extends StateMachineError {
  constructor(message: string, state?: State, cause?: Error) {
    super(message, 'TRANSITION_ERROR', state, cause);
    this.name = 'TransitionError';
  }
}

export class EffectError extends StateMachineError {
  constructor(message: string, state?: State, cause?: Error) {
    super(message, 'EFFECT_ERROR', state, cause);
    this.name = 'EffectError';
  }
}

export class TimeoutError extends StateMachineError {
  constructor(message: string, state?: State) {
    super(message, 'TIMEOUT_ERROR', state);
    this.name = 'TimeoutError';
  }
}

export class RetryExhaustedError extends StateMachineError {
  constructor(message: string, public readonly attempts: number, state?: State, cause?: Error) {
    super(message, 'RETRY_EXHAUSTED', state, cause);
    this.name = 'RetryExhaustedError';
  }
}
