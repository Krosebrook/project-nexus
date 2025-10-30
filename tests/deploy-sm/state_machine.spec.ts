import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStateMachine, effect, defaultRetryPolicy, type StateMachineConfig, type State, type Event, type SerializableState } from '../../packages/deploy-sm/src';

describe('StateMachine Framework', () => {
  type TestState = 'idle' | 'processing' | 'completed' | 'failed';
  type TestEvent = 'START' | 'SUCCESS' | 'FAIL' | 'RETRY';

  interface TestContext {
    value: number;
    logs: string[];
  }

  let context: TestContext;
  let hooks: any;

  beforeEach(() => {
    context = { value: 0, logs: [] };
    hooks = {
      onStateEnter: vi.fn(),
      onStateExit: vi.fn(),
      onTransition: vi.fn(),
      onError: vi.fn(),
      onRetry: vi.fn(),
      onComplete: vi.fn(),
      onLog: vi.fn(),
    };
  });

  describe('Happy Path', () => {
    it('should execute a simple state machine flow', async () => {
      const processingEffect = effect<TestContext>()
        .execute(async (ctx) => {
          ctx.value = 42;
          ctx.logs.push('processing');
          return { success: true, message: 'Processed' };
        })
        .setIdempotent(true)
        .build();

      const config: StateMachineConfig<TestState, TestEvent, TestContext> = {
        id: 'test-sm-1',
        initialState: 'idle',
        states: ['idle', 'processing', 'completed', 'failed'],
        events: ['START', 'SUCCESS', 'FAIL'],
        transitions: [
          { from: 'idle', to: 'processing', event: 'START' },
          { from: 'processing', to: 'completed', event: 'SUCCESS' },
          { from: 'processing', to: 'failed', event: 'FAIL' },
        ],
        effects: new Map([['processing', processingEffect]]),
        hooks,
      };

      const sm = createStateMachine(config, context);

      const result1 = await sm.dispatch({ type: 'START', timestamp: new Date() });
      expect(result1.success).toBe(true);
      expect(sm.getState().name).toBe('processing');
      expect(context.value).toBe(42);
      expect(context.logs).toContain('processing');

      const result2 = await sm.dispatch({ type: 'SUCCESS', timestamp: new Date() });
      expect(result2.success).toBe(true);
      expect(sm.getState().name).toBe('completed');

      await sm.complete();
      expect(hooks.onComplete).toHaveBeenCalled();
    });

    it('should track state history', async () => {
      const config: StateMachineConfig<TestState, TestEvent, TestContext> = {
        id: 'test-sm-2',
        initialState: 'idle',
        states: ['idle', 'processing', 'completed', 'failed'],
        events: ['START', 'SUCCESS'],
        transitions: [
          { from: 'idle', to: 'processing', event: 'START' },
          { from: 'processing', to: 'completed', event: 'SUCCESS' },
        ],
      };

      const sm = createStateMachine(config, context);

      await sm.dispatch({ type: 'START', timestamp: new Date() });
      await sm.dispatch({ type: 'SUCCESS', timestamp: new Date() });

      const history = sm.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].name).toBe('idle');
      expect(history[1].name).toBe('processing');
    });

    it('should calculate metrics correctly', async () => {
      const config: StateMachineConfig<TestState, TestEvent, TestContext> = {
        id: 'test-sm-3',
        initialState: 'idle',
        states: ['idle', 'processing', 'completed', 'failed'],
        events: ['START', 'SUCCESS'],
        transitions: [
          { from: 'idle', to: 'processing', event: 'START' },
          { from: 'processing', to: 'completed', event: 'SUCCESS' },
        ],
      };

      const sm = createStateMachine(config, context);

      await sm.dispatch({ type: 'START', timestamp: new Date() });
      await sm.dispatch({ type: 'SUCCESS', timestamp: new Date() });
      await sm.complete();

      const metrics = sm.getMetrics();
      expect(metrics.isComplete).toBe(true);
      expect(metrics.isFailed).toBe(false);
      expect(metrics.states.length).toBeGreaterThan(0);
    });
  });

  describe('Retries with Jitter', () => {
    it('should retry failed effects according to policy', async () => {
      let attempts = 0;
      const maxAttempts = 3;

      const failingEffect = effect<TestContext>()
        .execute(async (ctx) => {
          attempts++;
          ctx.logs.push(`attempt-${attempts}`);
          if (attempts < maxAttempts) {
            throw new Error(`Attempt ${attempts} failed`);
          }
          return { success: true, message: 'Finally succeeded' };
        })
        .setIdempotent(true)
        .build();

      const config: StateMachineConfig<TestState, TestEvent, TestContext> = {
        id: 'test-sm-4',
        initialState: 'idle',
        states: ['idle', 'processing', 'completed', 'failed'],
        events: ['START', 'SUCCESS'],
        transitions: [
          { from: 'idle', to: 'processing', event: 'START' },
          { from: 'processing', to: 'completed', event: 'SUCCESS' },
        ],
        effects: new Map([['processing', failingEffect]]),
        retryPolicy: {
          ...defaultRetryPolicy,
          maxAttempts: 3,
          initialDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
          jitterFactor: 0.1,
        },
        hooks,
      };

      const sm = createStateMachine(config, context);

      const result = await sm.dispatch({ type: 'START', timestamp: new Date() });
      expect(result.success).toBe(true);
      expect(attempts).toBe(maxAttempts);
      expect(context.logs).toHaveLength(maxAttempts);
      expect(hooks.onRetry).toHaveBeenCalledTimes(maxAttempts - 1);
    });

    it('should stop retrying when shouldRetry returns false', async () => {
      let attempts = 0;

      const failingEffect = effect<TestContext>()
        .execute(async (ctx) => {
          attempts++;
          throw new Error('Non-retryable error');
        })
        .setIdempotent(true)
        .build();

      const config: StateMachineConfig<TestState, TestEvent, TestContext> = {
        id: 'test-sm-5',
        initialState: 'idle',
        states: ['idle', 'processing', 'completed', 'failed'],
        events: ['START'],
        transitions: [
          { from: 'idle', to: 'processing', event: 'START' },
        ],
        effects: new Map([['processing', failingEffect]]),
        retryPolicy: {
          ...defaultRetryPolicy,
          maxAttempts: 5,
          shouldRetry: (error, attempt) => error.message !== 'Non-retryable error',
        },
        hooks,
      };

      const sm = createStateMachine(config, context);

      const result = await sm.dispatch({ type: 'START', timestamp: new Date() });
      expect(result.success).toBe(false);
      expect(attempts).toBe(1);
      expect(hooks.onRetry).not.toHaveBeenCalled();
    });

    it('should apply exponential backoff with jitter', async () => {
      const delays: number[] = [];
      let attempts = 0;

      const failingEffect = effect<TestContext>()
        .execute(async (ctx) => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Retry me');
          }
          return { success: true };
        })
        .setIdempotent(true)
        .build();

      const config: StateMachineConfig<TestState, TestEvent, TestContext> = {
        id: 'test-sm-6',
        initialState: 'idle',
        states: ['idle', 'processing', 'completed'],
        events: ['START'],
        transitions: [
          { from: 'idle', to: 'processing', event: 'START' },
        ],
        effects: new Map([['processing', failingEffect]]),
        retryPolicy: {
          maxAttempts: 3,
          initialDelayMs: 100,
          maxDelayMs: 1000,
          backoffMultiplier: 2,
          jitterFactor: 0.2,
        },
        hooks: {
          ...hooks,
          onRetry: async (attempt, error, state, ctx) => {
            delays.push(Date.now());
          },
        },
      };

      const sm = createStateMachine(config, context);
      const startTime = Date.now();

      await sm.dispatch({ type: 'START', timestamp: new Date() });

      expect(attempts).toBe(3);
      expect(delays.length).toBe(2);
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Cancellation', () => {
    it('should cancel state machine execution', async () => {
      const config: StateMachineConfig<TestState, TestEvent, TestContext> = {
        id: 'test-sm-7',
        initialState: 'idle',
        states: ['idle', 'processing', 'completed'],
        events: ['START', 'SUCCESS'],
        transitions: [
          { from: 'idle', to: 'processing', event: 'START' },
          { from: 'processing', to: 'completed', event: 'SUCCESS' },
        ],
        hooks,
      };

      const sm = createStateMachine(config, context);

      await sm.dispatch({ type: 'START', timestamp: new Date() });
      await sm.cancel();

      await expect(
        sm.dispatch({ type: 'SUCCESS', timestamp: new Date() })
      ).rejects.toThrow('cancelled');

      expect(hooks.onCancel).toHaveBeenCalled();
    });
  });

  describe('Idempotency', () => {
    it('should execute idempotent effects safely', async () => {
      let executionCount = 0;

      const idempotentEffect = effect<TestContext>()
        .execute(async (ctx) => {
          executionCount++;
          ctx.value = 100;
          return { success: true };
        })
        .setIdempotent(true)
        .build();

      const config: StateMachineConfig<TestState, TestEvent, TestContext> = {
        id: 'test-sm-8',
        initialState: 'idle',
        states: ['idle', 'processing', 'completed'],
        events: ['START', 'SUCCESS'],
        transitions: [
          { from: 'idle', to: 'processing', event: 'START' },
          { from: 'processing', to: 'completed', event: 'SUCCESS' },
        ],
        effects: new Map([['processing', idempotentEffect]]),
      };

      const sm = createStateMachine(config, context);

      await sm.dispatch({ type: 'START', timestamp: new Date() });
      expect(executionCount).toBe(1);
      expect(context.value).toBe(100);
    });

    it('should rollback non-idempotent effects on failure', async () => {
      let rollbackCalled = false;

      const nonIdempotentEffect = effect<TestContext>()
        .execute(async (ctx) => {
          throw new Error('Effect failed');
        })
        .rollback(async (ctx, state) => {
          rollbackCalled = true;
          ctx.logs.push('rolled-back');
        })
        .setIdempotent(false)
        .build();

      const config: StateMachineConfig<TestState, TestEvent, TestContext> = {
        id: 'test-sm-9',
        initialState: 'idle',
        states: ['idle', 'processing', 'completed'],
        events: ['START'],
        transitions: [
          { from: 'idle', to: 'processing', event: 'START' },
        ],
        effects: new Map([['processing', nonIdempotentEffect]]),
        retryPolicy: {
          maxAttempts: 2,
          initialDelayMs: 10,
          maxDelayMs: 50,
          backoffMultiplier: 2,
          jitterFactor: 0,
        },
      };

      const sm = createStateMachine(config, context);

      const result = await sm.dispatch({ type: 'START', timestamp: new Date() });
      expect(result.success).toBe(false);
      expect(rollbackCalled).toBe(true);
      expect(context.logs).toContain('rolled-back');
    });
  });

  describe('Serialization and Rehydration', () => {
    it('should serialize and rehydrate state', async () => {
      const config: StateMachineConfig<TestState, TestEvent, TestContext> = {
        id: 'test-sm-10',
        initialState: 'idle',
        states: ['idle', 'processing', 'completed'],
        events: ['START', 'SUCCESS'],
        transitions: [
          { from: 'idle', to: 'processing', event: 'START' },
          { from: 'processing', to: 'completed', event: 'SUCCESS' },
        ],
      };

      const sm1 = createStateMachine(config, context);
      await sm1.dispatch({ type: 'START', timestamp: new Date() });

      context.value = 999;
      const serialized = await sm1.serialize();

      const sm2 = createStateMachine(config, { value: 0, logs: [] });
      await sm2.rehydrate(serialized);

      expect(sm2.getState().name).toBe('processing');
      expect(sm2.getContext().value).toBe(999);
      expect(sm2.getHistory().length).toBe(1);
    });

    it('should persist state when configured', async () => {
      let persistedState: SerializableState<TestContext> | null = null;

      const config: StateMachineConfig<TestState, TestEvent, TestContext> = {
        id: 'test-sm-11',
        initialState: 'idle',
        states: ['idle', 'processing', 'completed'],
        events: ['START', 'SUCCESS'],
        transitions: [
          { from: 'idle', to: 'processing', event: 'START' },
          { from: 'processing', to: 'completed', event: 'SUCCESS' },
        ],
        persistState: async (state) => {
          persistedState = state;
        },
        loadState: async () => persistedState,
      };

      const sm = createStateMachine(config, context);
      await sm.dispatch({ type: 'START', timestamp: new Date() });

      expect(persistedState).not.toBeNull();
      expect(persistedState?.currentState.name).toBe('processing');
    });
  });

  describe('Guards', () => {
    it('should block transitions when guard returns false', async () => {
      const config: StateMachineConfig<TestState, TestEvent, TestContext> = {
        id: 'test-sm-12',
        initialState: 'idle',
        states: ['idle', 'processing', 'completed'],
        events: ['START', 'SUCCESS'],
        transitions: [
          {
            from: 'idle',
            to: 'processing',
            event: 'START',
            guard: async (ctx) => ctx.value > 10,
          },
          { from: 'processing', to: 'completed', event: 'SUCCESS' },
        ],
      };

      const sm = createStateMachine(config, context);

      const result1 = await sm.dispatch({ type: 'START', timestamp: new Date() });
      expect(result1.success).toBe(false);
      expect(sm.getState().name).toBe('idle');

      context.value = 20;

      const result2 = await sm.dispatch({ type: 'START', timestamp: new Date() });
      expect(result2.success).toBe(true);
      expect(sm.getState().name).toBe('processing');
    });
  });

  describe('Error Handling', () => {
    it('should invoke error hooks on failure', async () => {
      const errorEffect = effect<TestContext>()
        .execute(async (ctx) => {
          throw new Error('Critical error');
        })
        .setIdempotent(true)
        .build();

      const config: StateMachineConfig<TestState, TestEvent, TestContext> = {
        id: 'test-sm-13',
        initialState: 'idle',
        states: ['idle', 'processing', 'failed'],
        events: ['START'],
        transitions: [
          { from: 'idle', to: 'processing', event: 'START' },
        ],
        effects: new Map([['processing', errorEffect]]),
        retryPolicy: {
          maxAttempts: 1,
          initialDelayMs: 10,
          maxDelayMs: 50,
          backoffMultiplier: 1,
          jitterFactor: 0,
        },
        hooks,
      };

      const sm = createStateMachine(config, context);

      const result = await sm.dispatch({ type: 'START', timestamp: new Date() });
      expect(result.success).toBe(false);
      expect(hooks.onError).toHaveBeenCalled();
      expect(hooks.onError.mock.calls[0][0].message).toContain('Critical error');
    });
  });
});
