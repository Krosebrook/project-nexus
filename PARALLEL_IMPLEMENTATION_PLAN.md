# Parallel Implementation Plan: Phases 3-5

## Overview

This plan identifies **4 parallel development tracks** that can be executed simultaneously to implement the remaining phases of the Agent Execution Engine. Each track has minimal dependencies on others, allowing for concurrent development.

---

## Dependency Analysis

```
┌─────────────────────────────────────────────────────────────────┐
│                         CURRENT STATE                            │
│                    Phase 1: COMPLETE ✓                           │
│  • Validation, Idempotency, Cache, Audit Logging                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬──────────────┐
        │             │             │              │
        ▼             ▼             ▼              ▼
   ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐
   │ TRACK 1 │  │ TRACK 2 │  │ TRACK 3  │  │ TRACK 4  │
   │ Policy  │  │   LLM   │  │  Tools   │  │   Cost   │
   │  Layer  │  │ Client  │  │ Registry │  │  System  │
   └────┬────┘  └────┬────┘  └────┬─────┘  └────┬─────┘
        │            │            │              │
        └────────────┴────────────┴──────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  INTEGRATION PHASE     │
         │  Wire all components   │
         └────────────────────────┘
```

### Critical Path Dependencies

- **Phase 5** needs results from **Phase 4** (execution outputs)
- **Phase 4** needs policy approval from **Phase 3** (can proceed with mocks)
- **Phase 3** is mostly independent (can complete first)
- **Tools** are independent of LLM Client (can develop separately)
- **Cost System** is independent (uses only metadata)

---

## 🚀 Track 1: Policy & Resource Management (Phase 3)

**Estimated Lines:** ~800 lines
**Dependencies:** None (uses existing user_policies table)
**Completion Time:** 2-3 days

### Components

1. **AuthManager** (`auth-manager.ts`)
   - User tier lookup (free, pro, enterprise)
   - Policy constraints retrieval
   - Tier-based feature access (DCD, rate limits)
   - Seeding default policies

2. **ContextWindowValidator** (`context-validator.ts`)
   - Token estimation (4 chars = 1 token)
   - Prompt size calculation
   - Context window enforcement
   - Budget checking

3. **RateLimiter** (`rate-limiter.ts`)
   - Per-user rate tracking (requests/min, requests/hour)
   - In-memory + DB-backed counters
   - Sliding window algorithm
   - Reset logic

4. **PolicyEnforcer** (`policy-enforcer.ts`)
   - Orchestrates all policy checks
   - Recursion depth validation
   - Tool allowlist checking
   - Policy violation responses

5. **Phase3Orchestrator** (`phase3-policy.ts`)
   - Coordinates all Phase 3 checks
   - Returns CONTINUE or POLICY_VIOLATION

### Deliverables

- [ ] 5 implementation files
- [ ] 1 test suite per component (5 total)
- [ ] Integration with Phase 1 output
- [ ] Seed data for default tier policies

### Can Run in Parallel With

✅ Track 2 (LLM Client)
✅ Track 3 (Tools)
✅ Track 4 (Cost System)

---

## 🚀 Track 2: LLM Client & Resilience (Phase 4a)

**Estimated Lines:** ~600 lines
**Dependencies:** None (mocks external LLM API)
**Completion Time:** 3-4 days

### Components

1. **LLMClient Interface** (`llm-client.ts`)
   - Abstract interface for LLM providers
   - Request/response types
   - Streaming support (future)
   - Model configuration

2. **ResilientLLMClient** (`resilient-llm-client.ts`)
   - Exponential backoff retry (max 3 attempts)
   - Transient error detection (rate limits, network)
   - Circuit breaker pattern
   - Timeout handling
   - Token usage tracking

3. **MockLLMClient** (`mock-llm-client.ts`)
   - Deterministic responses for testing
   - Configurable delays
   - Error injection for testing resilience

4. **LLMPromptTemplates** (`llm-prompts.ts`)
   - Chain-of-Thought prompts
   - Tool selection prompts
   - System messages
   - Few-shot examples

5. **ErrorClassifier** (`error-classifier.ts`)
   - Classify errors as transient vs terminal
   - Retry decision logic
   - Error code mapping

### Deliverables

- [ ] 5 implementation files
- [ ] Integration tests with mock client
- [ ] Retry logic tests (exponential backoff)
- [ ] Token usage calculation

### Can Run in Parallel With

✅ Track 1 (Policy)
✅ Track 3 (Tools)
✅ Track 4 (Cost System)

---

## 🚀 Track 3: Tool Registry & Implementations (Phase 4b)

**Estimated Lines:** ~1,200 lines
**Dependencies:** None (tools are self-contained)
**Completion Time:** 4-5 days

### Components

1. **ToolRegistry** (`tool-registry.ts`)
   - Tool registration and lookup
   - Tool schema definitions
   - Input validation per tool
   - Tool availability checking

2. **Tool: workflow_orchestrator** (`tools/workflow-orchestrator.ts`)
   - Execute complex workflows (n8n/Activepieces)
   - Mock workflow client for testing
   - Result parsing

3. **Tool: google_search** (`tools/google-search.ts`)
   - Web search for grounding/RAG
   - Mock search service
   - Result ranking and filtering

4. **Tool: code_executor** (`tools/code-executor.ts`)
   - Execute code in sandbox (TS/JS/bash)
   - Timeout enforcement
   - Output capture
   - Security constraints

5. **Tool: submit_parallel_job** (`tools/parallel-job.ts`)
   - Submit long-running jobs
   - Return job ID immediately
   - Status polling interface

6. **Tool: retrieve_context** (`tools/retrieve-context.ts`)
   - RAG from knowledge base
   - Return top 5 chunks
   - Mock RAG client

7. **ToolDispatcher** (`tool-dispatcher.ts`)
   - Route tool calls to implementations
   - Track execution time and cost
   - Error handling per tool

### Deliverables

- [ ] 7 implementation files
- [ ] 1 test suite per tool (6 total)
- [ ] Mock services for external dependencies
- [ ] Tool execution logging

### Can Run in Parallel With

✅ Track 1 (Policy)
✅ Track 2 (LLM Client)
✅ Track 4 (Cost System)

---

## 🚀 Track 4: Cost Attribution & Serialization (Phase 5)

**Estimated Lines:** ~500 lines
**Dependencies:** Metadata from execution (can mock)
**Completion Time:** 2-3 days

### Components

1. **CostAttributor** (`cost-attributor.ts`)
   - Token cost calculation ($0.000002/token)
   - Tool cost calculation ($0.005/tool call)
   - Total cost aggregation
   - Cost breakdown by phase

2. **BillingReporter** (`billing-reporter.ts`)
   - Generate FINAL_BILLING_REPORT
   - Cost per decision/tool
   - User cost tracking
   - Export for billing systems

3. **ResponseSerializer** (`response-serializer.ts`)
   - Wrap final AguiResponse
   - Metadata enrichment
   - Timestamp normalization
   - JSON serialization

4. **Phase5Orchestrator** (`phase5-serialization.ts`)
   - Coordinate cost calculation
   - Write to cache (before finalizer)
   - Final audit log
   - Response formatting

### Deliverables

- [ ] 4 implementation files
- [ ] Cost calculation tests
- [ ] Serialization tests
- [ ] Integration with cache write

### Can Run in Parallel With

✅ Track 1 (Policy)
✅ Track 2 (LLM Client)
✅ Track 3 (Tools)

---

## 🔧 Track 5: Integration & Testing (Runs Throughout)

**Continuous throughout all tracks**

### Components

1. **Integration Tests** (`tests/integration/`)
   - End-to-end flow tests
   - Phase coordination tests
   - Error propagation tests

2. **Mock Data Generators** (`tests/mocks/`)
   - Generate test jobs
   - Mock LLM responses
   - Mock tool results

3. **Performance Tests** (`tests/performance/`)
   - Latency benchmarks
   - Cache hit rate analysis
   - Concurrent request handling

4. **Documentation Updates**
   - API documentation
   - Architecture diagrams
   - Usage examples

### Deliverables

- [ ] Integration test suite
- [ ] Mock data generators
- [ ] Performance benchmarks
- [ ] Updated README

---

## 🎯 Parallel Execution Strategy

### Week 1: Foundation (All Tracks Start)

| Track | Developer | Tasks |
|-------|-----------|-------|
| Track 1 | Dev A | AuthManager, ContextValidator |
| Track 2 | Dev B | LLMClient interface, ResilientLLMClient |
| Track 3 | Dev C | ToolRegistry, workflow_orchestrator |
| Track 4 | Dev D | CostAttributor, BillingReporter |
| Track 5 | QA | Mock data generators, test scaffolding |

### Week 2: Core Implementation

| Track | Developer | Tasks |
|-------|-----------|-------|
| Track 1 | Dev A | RateLimiter, PolicyEnforcer, Phase3Orchestrator |
| Track 2 | Dev B | MockLLMClient, LLMPromptTemplates, ErrorClassifier |
| Track 3 | Dev C | google_search, code_executor, submit_parallel_job |
| Track 4 | Dev D | ResponseSerializer, Phase5Orchestrator |
| Track 5 | QA | Integration tests, component testing |

### Week 3: Integration & Phase 4c

| Track | Developer | Tasks |
|-------|-----------|-------|
| Track 1 | Dev A | Testing, bug fixes, integration |
| Track 2 | Dev B | Testing, bug fixes, integration |
| Track 3 | Dev C | retrieve_context, ToolDispatcher, testing |
| Track 4 | Dev D | Testing, cache write coordination |
| Track 5 | QA | E2E tests, performance tests |
| **NEW** | Dev A+B | **RecursiveAgentRunner** (needs LLM + Policy) |

### Week 4: Recursive Agent Runner & Final Integration

| Component | Developers | Dependencies |
|-----------|------------|--------------|
| RecursiveAgentRunner | Dev A + Dev B | Track 1 + Track 2 + Track 3 |
| Phase4Orchestrator | Dev A + Dev B | RecursiveAgentRunner |
| Full E2E Tests | All | All tracks complete |
| Performance Tuning | All | All tracks complete |

---

## 📊 Parallelization Benefits

### Without Parallelization (Sequential)
```
Track 1 (3d) → Track 2 (4d) → Track 3 (5d) → Track 4 (3d) → Integration (7d)
Total: ~22 days
```

### With Parallelization (4 Developers)
```
Week 1: All tracks start
Week 2: All tracks progress
Week 3: Track 1,2,4 complete | Track 3 finishes | Start Runner
Week 4: Final integration
Total: ~20 days BUT with 4x throughput = ~5 days equivalent
```

**Time Savings: ~78% reduction in calendar time**

---

## 🧪 Testing Strategy Per Track

### Track 1 (Policy)
- Unit tests for each policy component
- Integration tests with Phase 1
- Policy violation scenarios
- Rate limit edge cases

### Track 2 (LLM Client)
- Retry logic tests (exponential backoff)
- Timeout handling
- Error classification tests
- Mock client determinism

### Track 3 (Tools)
- Individual tool tests
- Tool dispatcher routing
- Error handling per tool
- Cost tracking per tool

### Track 4 (Cost)
- Cost calculation accuracy
- Billing report format
- Serialization correctness
- Cache write timing

### Track 5 (Integration)
- Full Phase 1 → 3 → 4 → 5 flow
- Error propagation across phases
- Cache hit/miss scenarios
- Audit trail completeness

---

## 🚨 Critical Dependencies (Must Serialize)

These components **CANNOT** be parallelized due to hard dependencies:

1. **RecursiveAgentRunner**
   - Needs: LLMClient (Track 2) + ToolDispatcher (Track 3) + PolicyEnforcer (Track 1)
   - Start: Week 3 (after Tracks 1, 2, 3 core complete)

2. **Phase4Orchestrator**
   - Needs: RecursiveAgentRunner
   - Start: Week 3

3. **Final Integration**
   - Needs: All phases complete
   - Start: Week 4

---

## 📋 Checklist: Ready to Parallelize

Before starting parallel development, ensure:

- [x] Phase 1 is complete and tested
- [x] Database schema includes all required tables
- [x] Type definitions cover all phases
- [x] Audit logger supports all phases
- [ ] Mock services are defined for external dependencies
- [ ] Test data generators are available
- [ ] Development environment is set up for all developers

---

## 🎬 Next Steps

1. **Assign tracks** to available developers
2. **Set up mock services** (LLM API, workflow engine, search, RAG)
3. **Create feature branches** per track
4. **Define integration checkpoints** (weekly syncs)
5. **Start parallel development**

---

## 💡 Tips for Parallel Development

1. **Communication Protocol**
   - Daily standup to share progress
   - Slack channel for blocking issues
   - Shared mock definitions

2. **Integration Points**
   - Use TypeScript interfaces as contracts
   - Mock upstream dependencies
   - Integration tests as acceptance criteria

3. **Code Reviews**
   - Cross-review between tracks
   - Ensure consistent patterns
   - Share learnings

4. **Merge Strategy**
   - Merge Track 1 first (fewest dependencies)
   - Then Track 2 and 3 (parallel)
   - Then Track 4
   - Finally RecursiveAgentRunner

---

## 📈 Success Metrics

- [ ] All 4 tracks complete independently
- [ ] <5% integration bugs during merge
- [ ] 90%+ test coverage per track
- [ ] E2E tests pass on first integration
- [ ] Performance: <500ms Phase 3, <2s Phase 4 (excl. LLM), <100ms Phase 5

---

**Total Estimated Effort:** ~3,100 lines of code + tests
**Parallel Developers:** 4 + 1 QA
**Calendar Time:** ~4 weeks
**Equivalent Sequential Time:** ~16 weeks
**Time Savings:** 75%
