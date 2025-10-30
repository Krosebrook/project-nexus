# Deployment State Machine Framework

## Overview

The deployment state machine framework (`packages/deploy-sm`) is a reusable, type-safe orchestration engine for managing complex deployment workflows with built-in retry logic, idempotent effects, state persistence, and comprehensive error handling.

## Architecture

### Core Components

1. **StateMachine**: Main orchestrator for state transitions and effect execution
2. **States**: Typed state definitions representing workflow stages
3. **Events**: Typed triggers that cause state transitions
4. **Effects**: Side-effect handlers executed during state transitions
5. **Transitions**: Rules defining valid state changes
6. **RetryPolicy**: Configuration for automatic retry with exponential backoff and jitter

### Key Features

- **Type Safety**: Full TypeScript support for states, events, and context
- **Idempotency**: Effects can be marked as idempotent for safe retries
- **Retry with Jitter**: Exponential backoff with configurable jitter to prevent thundering herd
- **Rollback Support**: Non-idempotent effects can define rollback procedures
- **State Persistence**: Serialize/deserialize state for process restart recovery
- **Deterministic**: Same inputs produce same outputs (given idempotent effects)
- **Metrics & Logging**: Built-in hooks for observability
- **Guards**: Conditional transitions based on context
- **Timeouts**: Configurable timeouts for effects and transitions

## Usage

### Basic Example: Simple Deployment Flow

```typescript
import { createStateMachine, effect, defaultRetryPolicy, type StateMachineConfig } from '../packages/deploy-sm/src';

type DeployState = 'idle' | 'validating' | 'deploying' | 'completed' | 'failed';
type DeployEvent = 'START' | 'VALIDATED' | 'DEPLOYED' | 'FAIL';

interface DeployContext {
  deploymentId: number;
  projectId: number;
  logs: string[];
}

const validationEffect = effect<DeployContext>()
  .execute(async (context, state) => {
    console.log(`Validating deployment ${context.deploymentId}`);
    // Perform validation
    return { success: true, message: 'Validation passed' };
  })
  .setIdempotent(true)
  .build();

const deployEffect = effect<DeployContext>()
  .execute(async (context, state) => {
    console.log(`Deploying ${context.projectId}`);
    // Perform deployment
    return { success: true, message: 'Deployed' };
  })
  .rollback(async (context, state) => {
    console.log(`Rolling back deployment ${context.deploymentId}`);
    // Rollback logic
  })
  .setIdempotent(false)
  .build();

const config: StateMachineConfig<DeployState, DeployEvent, DeployContext> = {
  id: 'deployment-workflow',
  initialState: 'idle',
  states: ['idle', 'validating', 'deploying', 'completed', 'failed'],
  events: ['START', 'VALIDATED', 'DEPLOYED', 'FAIL'],
  transitions: [
    { from: 'idle', to: 'validating', event: 'START' },
    { from: 'validating', to: 'deploying', event: 'VALIDATED' },
    { from: 'deploying', to: 'completed', event: 'DEPLOYED' },
    { from: ['validating', 'deploying'], to: 'failed', event: 'FAIL' },
  ],
  effects: new Map([
    ['validating', validationEffect],
    ['deploying', deployEffect],
  ]),
  retryPolicy: {
    ...defaultRetryPolicy,
    maxAttempts: 3,
  },
  hooks: {
    onStateEnter: async (state, context) => {
      console.log(`Entered state: ${state.name}`);
    },
    onError: async (error, state, context) => {
      console.error(`Error in ${state.name}:`, error);
    },
  },
};

const context: DeployContext = {
  deploymentId: 123,
  projectId: 456,
  logs: [],
};

const sm = createStateMachine(config, context);

await sm.dispatch({ type: 'START', timestamp: new Date() });
await sm.dispatch({ type: 'VALIDATED', timestamp: new Date() });
await sm.dispatch({ type: 'DEPLOYED', timestamp: new Date() });
await sm.complete();
```

### Advanced Example: Blue/Green Deployment

```typescript
type BlueGreenState = 
  | 'idle'
  | 'preparing_green'
  | 'deploying_green'
  | 'testing_green'
  | 'switching_traffic'
  | 'monitoring'
  | 'completed'
  | 'rolling_back';

type BlueGreenEvent = 
  | 'START'
  | 'GREEN_READY'
  | 'DEPLOYED'
  | 'TESTS_PASSED'
  | 'TRAFFIC_SWITCHED'
  | 'HEALTH_OK'
  | 'HEALTH_FAIL'
  | 'ROLLBACK';

interface BlueGreenContext {
  deploymentId: number;
  blueVersion: string;
  greenVersion: string;
  trafficPercentage: number;
  healthChecksPassed: number;
}

const switchTrafficEffect = effect<BlueGreenContext>()
  .execute(async (context, state) => {
    // Gradually shift traffic from blue to green
    for (let pct = 10; pct <= 100; pct += 10) {
      context.trafficPercentage = pct;
      console.log(`Routing ${pct}% traffic to green`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return { success: true, message: 'Traffic switched' };
  })
  .rollback(async (context, state) => {
    console.log('Reverting traffic to blue');
    context.trafficPercentage = 0;
  })
  .setIdempotent(false)
  .build();

const monitorEffect = effect<BlueGreenContext>()
  .execute(async (context, state) => {
    // Monitor for 5 minutes
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 60000));
      const isHealthy = Math.random() > 0.1; // 90% success rate
      if (!isHealthy) {
        return { 
          success: false, 
          message: 'Health check failed',
          canRetry: false 
        };
      }
      context.healthChecksPassed++;
    }
    return { success: true, message: 'Monitoring complete' };
  })
  .setIdempotent(true)
  .build();

const blueGreenConfig: StateMachineConfig<BlueGreenState, BlueGreenEvent, BlueGreenContext> = {
  id: 'blue-green-deployment',
  initialState: 'idle',
  states: [
    'idle', 'preparing_green', 'deploying_green', 'testing_green',
    'switching_traffic', 'monitoring', 'completed', 'rolling_back'
  ],
  events: [
    'START', 'GREEN_READY', 'DEPLOYED', 'TESTS_PASSED',
    'TRAFFIC_SWITCHED', 'HEALTH_OK', 'HEALTH_FAIL', 'ROLLBACK'
  ],
  transitions: [
    { from: 'idle', to: 'preparing_green', event: 'START' },
    { from: 'preparing_green', to: 'deploying_green', event: 'GREEN_READY' },
    { from: 'deploying_green', to: 'testing_green', event: 'DEPLOYED' },
    { from: 'testing_green', to: 'switching_traffic', event: 'TESTS_PASSED' },
    { from: 'switching_traffic', to: 'monitoring', event: 'TRAFFIC_SWITCHED' },
    { from: 'monitoring', to: 'completed', event: 'HEALTH_OK' },
    { 
      from: ['testing_green', 'switching_traffic', 'monitoring'],
      to: 'rolling_back',
      event: 'HEALTH_FAIL'
    },
  ],
  effects: new Map([
    ['switching_traffic', switchTrafficEffect],
    ['monitoring', monitorEffect],
  ]),
  retryPolicy: {
    maxAttempts: 3,
    initialDelayMs: 5000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
  },
  timeout: {
    effectTimeout: 600000, // 10 minutes
  },
};
```

### Canary Deployment Example

```typescript
type CanaryState = 
  | 'idle'
  | 'deploying_canary'
  | 'monitoring_10_percent'
  | 'monitoring_50_percent'
  | 'monitoring_100_percent'
  | 'completed'
  | 'aborted';

type CanaryEvent = 
  | 'START'
  | 'CANARY_DEPLOYED'
  | 'METRICS_GOOD_10'
  | 'METRICS_GOOD_50'
  | 'METRICS_GOOD_100'
  | 'METRICS_BAD'
  | 'ABORT';

interface CanaryContext {
  deploymentId: number;
  version: string;
  trafficPercentage: number;
  errorRate: number;
  latencyP99: number;
  thresholds: {
    maxErrorRate: number;
    maxLatencyP99: number;
  };
}

const incrementTrafficEffect = (targetPct: number) => 
  effect<CanaryContext>()
    .execute(async (context, state) => {
      context.trafficPercentage = targetPct;
      console.log(`Canary traffic: ${targetPct}%`);
      
      // Monitor metrics for 5 minutes
      await new Promise(resolve => setTimeout(resolve, 300000));
      
      // Simulate metric collection
      context.errorRate = Math.random() * 0.02; // 0-2%
      context.latencyP99 = 100 + Math.random() * 50; // 100-150ms
      
      if (context.errorRate > context.thresholds.maxErrorRate) {
        return { 
          success: false, 
          message: `Error rate ${context.errorRate} exceeds threshold`,
          canRetry: false
        };
      }
      
      if (context.latencyP99 > context.thresholds.maxLatencyP99) {
        return { 
          success: false, 
          message: `Latency ${context.latencyP99}ms exceeds threshold`,
          canRetry: false
        };
      }
      
      return { success: true, message: `Metrics healthy at ${targetPct}%` };
    })
    .rollback(async (context, state) => {
      console.log('Aborting canary, reverting to 0%');
      context.trafficPercentage = 0;
    })
    .setIdempotent(false)
    .build();

const canaryConfig: StateMachineConfig<CanaryState, CanaryEvent, CanaryContext> = {
  id: 'canary-deployment',
  initialState: 'idle',
  states: [
    'idle', 'deploying_canary', 'monitoring_10_percent',
    'monitoring_50_percent', 'monitoring_100_percent', 'completed', 'aborted'
  ],
  events: [
    'START', 'CANARY_DEPLOYED', 'METRICS_GOOD_10',
    'METRICS_GOOD_50', 'METRICS_GOOD_100', 'METRICS_BAD', 'ABORT'
  ],
  transitions: [
    { from: 'idle', to: 'deploying_canary', event: 'START' },
    { from: 'deploying_canary', to: 'monitoring_10_percent', event: 'CANARY_DEPLOYED' },
    { from: 'monitoring_10_percent', to: 'monitoring_50_percent', event: 'METRICS_GOOD_10' },
    { from: 'monitoring_50_percent', to: 'monitoring_100_percent', event: 'METRICS_GOOD_50' },
    { from: 'monitoring_100_percent', to: 'completed', event: 'METRICS_GOOD_100' },
    { 
      from: ['monitoring_10_percent', 'monitoring_50_percent', 'monitoring_100_percent'],
      to: 'aborted',
      event: 'METRICS_BAD'
    },
  ],
  effects: new Map([
    ['monitoring_10_percent', incrementTrafficEffect(10)],
    ['monitoring_50_percent', incrementTrafficEffect(50)],
    ['monitoring_100_percent', incrementTrafficEffect(100)],
  ]),
  retryPolicy: {
    maxAttempts: 2,
    initialDelayMs: 10000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.15,
  },
};
```

## State Persistence & Recovery

### Saving State

```typescript
const config: StateMachineConfig<State, Event, Context> = {
  // ... other config
  persistState: async (state) => {
    await db.exec`
      UPDATE deployments 
      SET state_snapshot = ${JSON.stringify(state)}
      WHERE id = ${deploymentId}
    `;
  },
  loadState: async () => {
    const row = await db.queryRow<{ state_snapshot: string }>`
      SELECT state_snapshot FROM deployments WHERE id = ${deploymentId}
    `;
    return row ? JSON.parse(row.state_snapshot) : null;
  },
};
```

### Recovering from Crash

```typescript
const sm = createStateMachine(config, context);

const savedState = await config.loadState?.();
if (savedState) {
  await sm.rehydrate(savedState);
  console.log(`Resumed from state: ${sm.getState().name}`);
}

// Continue execution
```

## Guards & Conditional Transitions

```typescript
{
  from: 'testing',
  to: 'deploying',
  event: 'TESTS_PASSED',
  guard: async (context, event) => {
    // Only proceed if coverage > 80%
    const coverage = await getCoverage(context.projectId);
    return coverage > 0.8;
  },
}
```

## Retry Policy Configuration

```typescript
retryPolicy: {
  maxAttempts: 5,
  initialDelayMs: 1000,      // Start with 1s delay
  maxDelayMs: 60000,         // Cap at 60s
  backoffMultiplier: 2,      // Double each time
  jitterFactor: 0.2,         // ±20% randomness
  shouldRetry: (error, attempt) => {
    // Custom retry logic
    if (error.message.includes('permanent')) return false;
    if (attempt >= 3) return false;
    return true;
  },
}
```

## Hooks for Observability

```typescript
hooks: {
  onStateEnter: async (state, context) => {
    await metrics.recordStateEntry(state.name);
  },
  onStateExit: async (state, context) => {
    await metrics.recordStateExit(state.name);
  },
  onTransition: async (from, to, event, context) => {
    await logger.info(`Transition: ${from.name} -> ${to.name} (${event.type})`);
  },
  onError: async (error, state, context) => {
    await errorTracker.capture(error, { state: state.name });
  },
  onRetry: async (attempt, error, state, context) => {
    await logger.warn(`Retry ${attempt} for ${state.name}: ${error.message}`);
  },
  onComplete: async (finalState, context, metrics) => {
    await notifier.send(`Deployment completed in ${metrics.totalDurationMs}ms`);
  },
  onMetric: async (metric) => {
    await metricsDb.insert(metric);
  },
  onLog: async (level, message, metadata) => {
    console[level](`[SM] ${message}`, metadata);
  },
}
```

## Best Practices

### 1. Design Idempotent Effects

```typescript
// GOOD: Idempotent database update
const effect = effect<Context>()
  .execute(async (context, state) => {
    await db.exec`
      INSERT INTO deployments (id, status)
      VALUES (${context.id}, 'deploying')
      ON CONFLICT (id) DO UPDATE SET status = 'deploying'
    `;
    return { success: true };
  })
  .setIdempotent(true)
  .build();

// BAD: Non-idempotent without rollback
const badEffect = effect<Context>()
  .execute(async (context, state) => {
    await db.exec`
      UPDATE counter SET count = count + 1
    `;
    return { success: true };
  })
  .setIdempotent(false)
  .build(); // Missing rollback!
```

### 2. Provide Rollback for Critical Effects

```typescript
const migrationEffect = effect<Context>()
  .execute(async (context, state) => {
    const version = await runMigration(context.migrationFile);
    context.currentVersion = version;
    return { success: true, metadata: { version } };
  })
  .rollback(async (context, state) => {
    await rollbackMigration(context.currentVersion);
  })
  .setIdempotent(false)
  .build();
```

### 3. Use Guards for Safety

```typescript
{
  from: 'deploying',
  to: 'production',
  event: 'PROMOTE',
  guard: async (context, event) => {
    // Require manual approval for production
    return await hasApproval(context.deploymentId);
  },
}
```

### 4. Leverage Metrics

```typescript
hooks: {
  onMetric: async (metric) => {
    if (metric.durationMs && metric.durationMs > 300000) {
      await alerting.send(`State ${metric.state} took ${metric.durationMs}ms`);
    }
  },
}
```

### 5. Never Log Secrets

```typescript
// BAD
onLog: async (level, message, metadata) => {
  console.log(message, metadata); // May contain secrets!
}

// GOOD
onLog: async (level, message, metadata) => {
  const sanitized = { ...metadata };
  delete sanitized.apiKey;
  delete sanitized.token;
  console.log(message, sanitized);
}
```

## Testing

### Unit Test Example

```typescript
import { createStateMachine, effect } from '../packages/deploy-sm/src';

it('should retry failed effects', async () => {
  let attempts = 0;
  
  const failingEffect = effect<Context>()
    .execute(async (ctx) => {
      attempts++;
      if (attempts < 3) throw new Error('Retry me');
      return { success: true };
    })
    .setIdempotent(true)
    .build();

  const sm = createStateMachine(config, context);
  await sm.dispatch({ type: 'START', timestamp: new Date() });
  
  expect(attempts).toBe(3);
});
```

## Troubleshooting

### State Machine Stuck

Check for missing transitions:
```typescript
const currentState = sm.getState();
console.log('Current state:', currentState.name);
console.log('Available transitions:', config.transitions.filter(t => 
  (Array.isArray(t.from) ? t.from.includes(currentState.name) : t.from === currentState.name)
));
```

### Retry Exhausted

Review retry policy and error messages:
```typescript
hooks: {
  onRetry: async (attempt, error, state, context) => {
    console.error(`Retry ${attempt} failed:`, error.message);
  },
}
```

### State Not Persisting

Verify persistence hooks are called:
```typescript
persistState: async (state) => {
  console.log('Persisting state:', state.currentState.name);
  await saveToDb(state);
},
```

## Performance Considerations

- **Effect Timeouts**: Set appropriate timeouts to prevent hanging
- **Retry Jitter**: Use jitter to prevent thundering herd on failures
- **State Size**: Keep state data minimal; use context for large objects
- **Persistence Frequency**: Persist only on critical state changes if high throughput

## Security

- Never log sensitive data (secrets, tokens, PII)
- Use guards to enforce authorization checks
- Validate context data before state transitions
- Sanitize error messages before exposing to users
- Persist encrypted state for sensitive workflows
