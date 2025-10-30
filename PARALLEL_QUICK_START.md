# Parallel Development Quick Start

## 🎯 TL;DR: What Can Run in Parallel?

**4 independent tracks can start TODAY simultaneously:**

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   TRACK 1   │  │   TRACK 2   │  │   TRACK 3   │  │   TRACK 4   │
│   Policy    │  │  LLM Client │  │    Tools    │  │    Cost     │
│   Layer     │  │  + Retry    │  │  Registry   │  │ Attribution │
│             │  │             │  │             │  │             │
│ ~800 lines  │  │ ~600 lines  │  │ ~1200 lines │  │ ~500 lines  │
│  2-3 days   │  │  3-4 days   │  │  4-5 days   │  │  2-3 days   │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
       ✓              ✓                ✓                 ✓
  NO BLOCKERS    NO BLOCKERS      NO BLOCKERS       NO BLOCKERS
```

**After Tracks 1-3 complete:** Build RecursiveAgentRunner (needs all 3)

---

## 🚀 Track 1: Policy & Resource (Phase 3)

### Goal
Enforce user tier policies, rate limits, and resource constraints.

### Components to Build (in order of priority)

1. **`auth-manager.ts`** (FIRST)
   - User tier lookup (free/pro/enterprise)
   - Fetch policy constraints from `agent_user_policies` table
   - Default policy seeding

2. **`context-validator.ts`** (SECOND)
   - Token estimation: `chars / 4 ≈ tokens`
   - Check if `promptTokens <= contextWindowLimit`
   - Budget enforcement

3. **`rate-limiter.ts`** (THIRD)
   - Track requests per user (in-memory + DB)
   - Sliding window: requests/minute, requests/hour
   - Return `true` (allow) or `false` (reject)

4. **`policy-enforcer.ts`** (FOURTH)
   - Orchestrate all checks
   - Validate recursion depth, tool allowlist
   - Return CONTINUE or POLICY_VIOLATION

5. **`phase3-policy.ts`** (FIFTH)
   - Main orchestrator calling auth, context, rate, policy
   - Integrate with Phase 1 output

### Success Criteria
- [ ] Can load user policy from DB
- [ ] Can reject requests exceeding rate limit
- [ ] Can reject requests exceeding context window
- [ ] Returns POLICY_VIOLATION with details
- [ ] Integration tests with Phase 1

### No Dependencies On
✅ Track 2, 3, 4 (completely independent)

---

## 🚀 Track 2: LLM Client (Phase 4a)

### Goal
Build resilient LLM client with exponential backoff retry.

### Components to Build (in order of priority)

1. **`llm-client.ts`** (FIRST - Interface)
   ```typescript
   interface LLMClient {
     call(prompt: string, config: LLMConfig): Promise<LLMResponse>;
     countTokens(text: string): number;
   }
   ```

2. **`mock-llm-client.ts`** (SECOND - For Testing)
   - Hardcoded responses for testing
   - Configurable delays, errors
   - Token counting simulation

3. **`error-classifier.ts`** (THIRD)
   - Classify errors as `TransientError` vs `TerminalError`
   - Map API error codes to error types
   - Retry decision logic

4. **`resilient-llm-client.ts`** (FOURTH - Core)
   - Exponential backoff: 1s, 2s, 4s (max 3 retries)
   - Wrap raw LLM calls
   - Retry on `TransientError` only
   - Track token usage

5. **`llm-prompts.ts`** (FIFTH)
   - Chain-of-Thought system prompt
   - Tool selection prompt
   - Few-shot examples

### Success Criteria
- [ ] Mock client returns deterministic responses
- [ ] Resilient client retries 3 times on transient errors
- [ ] Exponential backoff verified (1s, 2s, 4s)
- [ ] Terminal errors fail immediately (no retry)
- [ ] Token usage tracked

### No Dependencies On
✅ Track 1, 3, 4 (uses mocks, no real LLM needed yet)

---

## 🚀 Track 3: Tool Registry (Phase 4b)

### Goal
Build tool registry and implement 5 tools.

### Components to Build (in order of priority)

1. **`tool-registry.ts`** (FIRST)
   - Register tools by name
   - Validate tool arguments
   - Tool schema definitions
   - Tool lookup

2. **`tools/workflow-orchestrator.ts`** (SECOND)
   ```typescript
   async execute(workflow: string, params: any): Promise<any>
   // Mock n8n/Activepieces client
   ```

3. **`tools/google-search.ts`** (THIRD)
   ```typescript
   async search(query: string): Promise<SearchResult[]>
   // Mock search service
   ```

4. **`tools/code-executor.ts`** (FOURTH)
   ```typescript
   async executeCode(code: string, lang: string): Promise<ExecutionResult>
   // Mock sandbox execution
   ```

5. **`tools/parallel-job.ts`** (FIFTH)
   ```typescript
   async submitJob(jobSpec: any): Promise<{ jobId: string }>
   // Mock job queue
   ```

6. **`tools/retrieve-context.ts`** (SIXTH)
   ```typescript
   async retrieve(query: string): Promise<ContextChunk[]>
   // Mock RAG client, return top 5
   ```

7. **`tool-dispatcher.ts`** (SEVENTH - Orchestrator)
   - Route tool calls to implementations
   - Track execution time/cost per tool
   - Error handling

### Success Criteria
- [ ] All 5 tools registered in registry
- [ ] Tool dispatcher routes calls correctly
- [ ] Each tool logs execution time and cost
- [ ] Mock services return realistic data
- [ ] Unit tests for each tool

### No Dependencies On
✅ Track 1, 2, 4 (tools are self-contained)

---

## 🚀 Track 4: Cost Attribution (Phase 5)

### Goal
Calculate costs and serialize final response.

### Components to Build (in order of priority)

1. **`cost-attributor.ts`** (FIRST)
   ```typescript
   calculateTokenCost(tokens: number): number {
     return tokens * 0.000002; // $0.000002 per token
   }

   calculateToolCost(toolCalls: number): number {
     return toolCalls * 0.005; // $0.005 per tool
   }
   ```

2. **`billing-reporter.ts`** (SECOND)
   - Generate `FINAL_BILLING_REPORT`
   - Break down cost by phase
   - Per-decision cost, per-tool cost

3. **`response-serializer.ts`** (THIRD)
   - Wrap final `AguiResponse`
   - Add metadata (timestamps, costs)
   - JSON serialization

4. **`phase5-serialization.ts`** (FOURTH)
   - Calculate total cost
   - Write to cache (BEFORE returning)
   - Final audit log
   - Return response

### Success Criteria
- [ ] Cost calculations match spec ($0.000002/token, $0.005/tool)
- [ ] Billing report includes all cost breakdowns
- [ ] Response serializer produces valid `AguiResponse`
- [ ] Cache write happens before response return
- [ ] Unit tests for cost calculation

### No Dependencies On
✅ Track 1, 2, 3 (uses only metadata, can mock execution results)

---

## 🔒 What CANNOT Run in Parallel?

These components have hard dependencies and must wait:

### RecursiveAgentRunner (Week 3)
```
Needs: ✅ Track 1 (PolicyEnforcer)
       ✅ Track 2 (ResilientLLMClient)
       ✅ Track 3 (ToolDispatcher)

Implements:
- Chain-of-Thought reasoning loop
- Decide: LLM_CALL vs TOOL_CALL vs FINAL_ANSWER
- Enforce maxDepth (recursion limit)
- Dispatch tools when needed
- Track decisions for audit
```

**Cannot start until:** Tracks 1, 2, 3 have core components ready

### Phase4Orchestrator (Week 3)
```
Needs: ✅ RecursiveAgentRunner
       ✅ PolicyEnforcer (Track 1)

Implements:
- Call Phase 3 for policy check
- If CONTINUE: Run RecursiveAgentRunner
- Track execution time
- Return results to Phase 5
```

**Cannot start until:** RecursiveAgentRunner is complete

---

## 📅 Week-by-Week Timeline

### Week 1: Foundation (All Parallel)
```
Day 1-2: Track 1 → AuthManager, ContextValidator
Day 1-3: Track 2 → LLMClient interface, MockLLMClient, ErrorClassifier
Day 1-4: Track 3 → ToolRegistry, workflow_orchestrator, google_search
Day 1-2: Track 4 → CostAttributor, BillingReporter
```

### Week 2: Core Implementation (All Parallel)
```
Day 3-5: Track 1 → RateLimiter, PolicyEnforcer, Phase3Orchestrator
Day 4-7: Track 2 → ResilientLLMClient, LLMPrompts, testing
Day 5-10: Track 3 → code_executor, parallel_job, retrieve_context, ToolDispatcher
Day 3-5: Track 4 → ResponseSerializer, Phase5Orchestrator
```

### Week 3: Integration + Runner (Mixed)
```
Track 1, 2, 4: Testing, bug fixes, integration complete ✓
Track 3: ToolDispatcher complete, testing ✓

NEW: RecursiveAgentRunner (Track 1 + 2 + 3 devs)
- Needs all 3 tracks complete
- 3-4 days development
- 1-2 days testing
```

### Week 4: Final Integration
```
All Tracks: Phase4Orchestrator, E2E tests, performance tuning
```

---

## 🧪 Testing Strategy

### Each Track Should Have:

1. **Unit Tests**
   - Each component tested in isolation
   - Mock external dependencies
   - Edge cases covered

2. **Integration Tests**
   - Track integrated with Phase 1
   - Track integrated with database
   - Error propagation tested

3. **Mock Services**
   - Track 2: Mock LLM API
   - Track 3: Mock external tools
   - Track 4: Mock execution results

---

## 🎬 How to Start (Today)

### 1. Assign Tracks
```bash
Developer A → Track 1 (Policy)
Developer B → Track 2 (LLM Client)
Developer C → Track 3 (Tools)
Developer D → Track 4 (Cost)
QA Engineer → Integration tests, mocks
```

### 2. Create Feature Branches
```bash
git checkout -b feature/phase3-policy
git checkout -b feature/phase4-llm-client
git checkout -b feature/phase4-tools
git checkout -b feature/phase5-cost
```

### 3. Set Up Mocks
```bash
backend/agent-engine/mocks/
├── mock-llm-api.ts        # For Track 2
├── mock-workflow-engine.ts # For Track 3
├── mock-search-service.ts  # For Track 3
├── mock-rag-client.ts      # For Track 3
└── mock-execution-results.ts # For Track 4
```

### 4. Daily Sync
- 15-min standup
- Share progress
- Unblock issues
- Coordinate integration

---

## 📊 Progress Tracking

```
Track 1 (Policy):      [░░░░░░░░░░] 0% - AuthManager in progress
Track 2 (LLM):         [░░░░░░░░░░] 0% - LLMClient interface defined
Track 3 (Tools):       [░░░░░░░░░░] 0% - ToolRegistry started
Track 4 (Cost):        [░░░░░░░░░░] 0% - CostAttributor started

RecursiveRunner:       [BLOCKED] Waiting for Tracks 1-3
Phase4Orchestrator:    [BLOCKED] Waiting for RecursiveRunner
E2E Integration:       [BLOCKED] Waiting for all phases
```

Update this daily to track progress.

---

## 🚨 Red Flags

Stop and sync if:
- ❌ Type definitions don't match between tracks
- ❌ Mock data structures differ
- ❌ Integration test failures >10%
- ❌ One track blocked >2 days

---

## ✅ Definition of Done (Per Track)

Before merging, ensure:
- [ ] All components implemented
- [ ] Unit tests pass (>90% coverage)
- [ ] Integration tests with Phase 1 pass
- [ ] Code reviewed by another track member
- [ ] No blocking bugs
- [ ] Documentation updated

---

## 💡 Pro Tips

1. **Use TypeScript interfaces as contracts** - Define interfaces first, implement later
2. **Mock early, mock often** - Don't wait for real services
3. **Integrate weekly** - Merge to main every Friday
4. **Communicate blockers immediately** - Don't wait for standup
5. **Share test data** - Use common mock generators

---

**Ready to parallelize? Start with Track 1 (quickest) or Track 3 (most complex).**

See `PARALLEL_IMPLEMENTATION_PLAN.md` for full details.
