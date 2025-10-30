# Agent Execution Engine - Phase 1: Ingestion

Part of the **FlashFusion/Cortex-Nexus** Autonomous AI Agent Execution Engine.

## Overview

The Agent Execution Engine is a sophisticated, resilient, and observable system designed to orchestrate autonomous AI agent workflows. This implementation provides **Phase 1 (Ingestion)**, establishing the foundation for the complete 5-phase execution architecture.

## Architecture

### Complete System (5 Phases)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT REQUEST (Raw Payload)                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: INGESTION                                  [✓ COMPLETE] │
│ ─────────────────────────────────────────────────────────────── │
│ • Validate payload against AguiRunJobSchema                      │
│ • Calculate Intent Signature (SHA256 of stable params)           │
│ • Cache Lookup → If HIT: Return cached response                 │
│                 If MISS: Continue to Phase 2                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: POLICY & RESOURCE                     [❌ NOT IMPLEMENTED]
│ ─────────────────────────────────────────────────────────────── │
│ • Enforce user tier policy (AuthManager)                         │
│ • Context window validation (4 chars/token estimation)           │
│ • Rate limiting checks                                           │
│ • Resource constraint enforcement                                │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: EXECUTION                              [❌ NOT IMPLEMENTED]
│ ─────────────────────────────────────────────────────────────── │
│ • Recursive Agent Runner (Chain-of-Thought)                      │
│ • Tool dispatch (workflow, search, code, parallel, RAG)          │
│ • Maximum recursion depth enforcement                            │
│ • ResilientLLMClient with exponential backoff                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: SERIALIZATION                          [❌ NOT IMPLEMENTED]
│ ─────────────────────────────────────────────────────────────── │
│ • Final wrapping of AguiResponse                                 │
│ • Cost attribution ($0.000002/token, $0.005/tool)                │
│ • Cache write (before finalizer)                                 │
│ • Final audit log (FINAL_BILLING_REPORT)                         │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
            ┌─────────────────────┐
            │  AGUIRESPONSE       │
            │  (Client Response)  │
            └─────────────────────┘
```

## Phase 1 Components (Implemented)

### 1. Core Types & Schemas (`types.ts`, `schemas.ts`)

Defines all data structures with strict Zod validation:

- **AgentActionType**: `LLM_CALL`, `TOOL_CALL`, `FINAL_ANSWER`
- **AgentStatus**: `COMPLETE`, `ERROR`, `NEXT_STEP`, `TOOL_DISPATCHED`, `PARALLEL_PENDING`
- **ToolName**: `workflow_orchestrator`, `google_search`, `code_executor`, `submit_parallel_job`, `retrieve_context`
- **AguiRunJob**: Complete job payload schema
- **AguiResponse**: Complete response schema

### 2. Idempotency Mechanism (`idempotency.ts`)

Implements intent signature calculation for request deduplication:

```typescript
const signature = calculateIntentSignature(job);
// Produces: "a3f2b8c9..." (SHA256 hash, 64 chars)
```

**Stable Parameters** (included in signature):
- `userId`, `prompt`, `maxDepth`, `contextWindowLimit`
- `previousContext`, `toolResults`, `metadata`

**Volatile Parameters** (excluded from signature):
- `correlationId`, `currentDepth`

This ensures identical requests (same intent) produce the same signature, enabling cache hits.

### 3. Result Cache (`result-cache.ts`)

PostgreSQL-backed cache with:
- **Lookup**: Fast retrieval by intent signature
- **Write**: TTL-based caching (default: 24h, max: 7 days)
- **Invalidation**: Per-user or per-signature
- **Statistics**: Hit count, age tracking
- **Health Check**: Operational status monitoring

### 4. Audit Logger (`audit-logger.ts`)

Complete audit trail for **Dynamic Context Debugger (DCD)** - a monetized Pro/Enterprise feature:

- Logs all events by `correlationId`
- Phase-based event tracking
- Chronological audit trail retrieval
- User statistics and analytics
- Configurable retention by tier (Free: 7d, Pro: 30d, Enterprise: 90d)

### 5. Phase 1 Orchestrator (`phase1-ingestion.ts`)

Main Phase 1 execution flow:

```typescript
const phase1Result = await phase1Ingestion.execute(rawPayload);

// Result types:
// - CACHE_HIT: Return cached response immediately
// - CONTINUE: Proceed to Phase 2
// - ERROR: Validation failed
```

### 6. API Endpoints (`engine.ts`)

Exposed via Encore.dev framework:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent/execute` | POST | Submit agent execution job |
| `/agent/audit/:correlationId` | GET | Retrieve audit trail (DCD) |
| `/agent/cache/stats` | GET | Get cache statistics |
| `/agent/cache/:userId` | DELETE | Invalidate user cache |
| `/agent/health` | GET | System health check |

## Database Schema

### Tables Created (Migration 018)

1. **`agent_result_cache`** - Idempotency cache
   - Indexed by `intent_signature` (unique)
   - TTL-based expiration
   - Hit count tracking

2. **`agent_audit_logs`** - Audit trail for DCD
   - Indexed by `correlation_id`
   - Phase and event tracking
   - JSONB details storage

3. **`agent_execution_metadata`** - High-level execution stats
   - Correlation ID, signature, status
   - Resource usage (tokens, cost, time)
   - Error tracking

4. **`agent_user_policies`** - Per-user policy constraints
   - Tier-based limits (free, pro, enterprise)
   - DCD access control
   - Rate limiting configuration

5. **`agent_tool_executions`** - Individual tool call logs
   - Tool name, arguments, result
   - Execution time and cost
   - Status tracking

## Testing

Comprehensive test suites included:

- **`idempotency.test.ts`**: 15+ tests for signature calculation, normalization, edge cases
- **`schemas.test.ts`**: 30+ tests for all Zod schemas, validation boundaries, error cases

Run tests:
```bash
cd backend
bun test agent-engine
```

## Usage Example

### Submit a Job

```typescript
const response = await fetch('http://localhost:4000/agent/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    prompt: 'What is the capital of France?',
    correlationId: '550e8400-e29b-41d4-a716-446655440000',
    maxDepth: 5,
    contextWindowLimit: 8000
  })
});

const result = await response.json();
// Result includes: status, phaseResult, executionTime, fromCache, etc.
```

### Check Cache Statistics

```typescript
const stats = await fetch('http://localhost:4000/agent/cache/stats?userId=user123');
// Returns: { totalEntries, totalHits, avgHitCount, oldestEntry, newestEntry }
```

### Retrieve Audit Trail (DCD)

```typescript
const audit = await fetch('http://localhost:4000/agent/audit/550e8400-e29b-41d4-a716-446655440000?userId=user123');
// Returns: { correlationId, summary, trail: [...events] }
```

## Key Features

✅ **Implemented in Phase 1:**
- Request validation with Zod
- Intent signature for idempotency
- PostgreSQL-backed result cache
- Complete audit logging (DCD foundation)
- Health monitoring
- Comprehensive test coverage

❌ **Not Yet Implemented:**
- Phase 2: (Skipped in spec)
- Phase 3: Policy & Resource checks
- Phase 4: Recursive Agent Runner + LLM Client
- Phase 5: Serialization + Cost Attribution

## Configuration

### Cache TTL

```typescript
// In result-cache.ts
export const CACHE_CONFIG = {
  DEFAULT_TTL_HOURS: 24,
  MAX_TTL_HOURS: 168,     // 7 days
  MIN_TTL_HOURS: 1,
};
```

### Audit Retention

```typescript
// In audit-logger.ts
export const AUDIT_CONFIG = {
  RETENTION: {
    free: 7,
    pro: 30,
    enterprise: 90,
  },
};
```

## Error Handling

Phase 1 error codes:
- `PHASE1_VALIDATION_FAILED`: Invalid payload schema
- `PHASE1_CACHE_ERROR`: Cache operation failed (non-fatal)
- `PHASE1_UNKNOWN_ERROR`: Unexpected error

All errors are:
1. Logged to audit trail
2. Returned in standardized format
3. Non-blocking for cache operations (fail gracefully)

## Performance Considerations

- **Cache Lookup**: Single indexed query, O(1) average
- **Signature Calculation**: SHA256 hashing, <1ms typical
- **Audit Logging**: Async, non-blocking (errors logged but don't fail execution)
- **Database**: Connection pooling via Encore.dev

## Next Steps

To complete the full execution engine, implement:

1. **Phase 3**: Policy enforcement, rate limiting, context window checks
2. **Phase 4**: Recursive agent runner, tool registry, LLM client with retry logic
3. **Phase 5**: Cost attribution, final serialization, cache write coordination

## Documentation

For more details on the complete system architecture, see the platform specification document.

## License

Part of the FlashFusion/Cortex-Nexus project.
