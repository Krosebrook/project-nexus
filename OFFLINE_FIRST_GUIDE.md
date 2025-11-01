# Offline-First Web Application Guide

## Architecture Overview

This deployment platform is built as a **production-grade, offline-first web application** using:

- **Frontend:** React + TypeScript + Dexie.js (IndexedDB)
- **Backend:** Encore.ts + PostgreSQL
- **Real-Time Sync:** HTTP-based polling + CRDT conflict resolution
- **LLM Integration:** Claude/Gemini with SSE streaming

## Key Features

### 1. Offline-First Data Layer

**IndexedDB Schema** (`/frontend/db/schema.ts`):
- `deployments` - Full deployment history
- `projects` - Project metadata
- `artifacts` - Build artifacts and versions
- `queue_items` - Deployment queue
- `sync_events` - Change log for synchronization
- `sync_conflicts` - Detected conflicts awaiting resolution

**Storage Quotas:**
- Keeps last 200 deployments
- Auto-prunes data older than 90 days
- Warns at 80% quota usage
- Total estimated usage: ~50MB for typical use

### 2. Sync Engine with CRDT

**Location:** `/frontend/lib/sync-engine.ts`

**Features:**
- Version vector-based conflict detection
- Exponential backoff reconnection (max 10 attempts)
- Batch syncing (50 events per batch)
- Automatic retry on network failure

**How It Works:**
```typescript
// Start sync engine
import { syncEngine } from './lib/sync-engine';

await syncEngine.start();

// Listen to events
syncEngine.on('sync-complete', ({ pushed, pulled, conflicts }) => {
  console.log(`Synced: ${pushed} pushed, ${pulled} pulled, ${conflicts} conflicts`);
});

syncEngine.on('conflict', (conflict) => {
  // Show conflict resolution UI
});
```

### 3. Optimistic UI Updates

**Location:** `/frontend/hooks/useOptimisticMutation.ts`

**Example:**
```typescript
const { mutate, isLoading, error } = useOptimisticMutation({
  mutationFn: async (data) => {
    return await backend.deployments.create(data);
  },
  onSuccess: (result) => {
    toast.success('Deployment created');
  },
  onError: (error) => {
    toast.error('Failed to create deployment');
  },
});

// Apply optimistic update immediately
await mutate(
  { name: 'New Deploy' },
  { id: 'temp-123', status: 'pending' }
);
```

### 4. LLM Router with Fallback Chain

**Location:** `/backend/llm/router.ts`

**Provider Priority:**
1. **Claude Sonnet 4** - Code generation, refactoring (High cost)
2. **Gemini Pro** - Analysis, documentation (Medium cost)
3. **Ollama Local** - Fallback for offline/free usage (Free)

**Rate Limiting:**
- 10 requests per minute per user
- Automatic fallback to cheaper provider on failure
- SSE streaming for real-time responses

**Example:**
```typescript
import { useLLMStream } from './hooks/useLLMStream';

const { stream, cancel, isStreaming, output } = useLLMStream();

await stream('Generate a TypeScript function', 'auto');
```

### 5. Conflict Resolution UI

**Location:** `/frontend/components/ConflictResolutionModal.tsx`

**Strategies:**
- **Server Wins (Default)** - Use remote version
- **Local Wins** - Keep local changes
- **Manual Merge** - Review diff and choose

**UI Features:**
- Side-by-side diff viewer
- Syntax-highlighted JSON comparison
- Conflict queue with count

## Usage Guide

### Initializing the Database

```typescript
import { db } from './db/schema';

// Database auto-initializes on first access
const deployments = await db.deployments.toArray();

// Check storage
const { usage, quota, percentage } = await db.getStorageEstimate();
console.log(`Using ${percentage}% of storage`);

// Manual cleanup
await db.pruneOldData(90); // Keep last 90 days
```

### Handling Offline State

```typescript
import { syncEngine } from './lib/sync-engine';

// Listen for online/offline events
window.addEventListener('online', () => {
  console.log('Back online - syncing...');
  syncEngine.sync();
});

window.addEventListener('offline', () => {
  console.log('Offline mode - changes will queue');
});
```

### Creating Deployments Offline

```typescript
import { db } from './db/schema';

// Create deployment (works offline)
const deployment = await db.deployments.add({
  id: generateId(),
  name: 'Offline Deploy',
  status: 'pending',
  project_id: 'proj-123',
  environment: 'staging',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: userId,
  version: 0,
  client_id: db.getClientId(),
  synced: false, // Will sync when online
});

// Sync will happen automatically when online
```

### Using LLM Streaming

```typescript
import { useLLMStream } from './hooks/useLLMStream';

function CodeGenerator() {
  const { stream, cancel, isStreaming, output, error } = useLLMStream({
    onChunk: (chunk) => console.log('Received:', chunk),
    onComplete: (fullText) => console.log('Done:', fullText),
  });

  const handleGenerate = async () => {
    await stream('Generate a sorting function', 'auto');
  };

  return (
    <div>
      <button onClick={handleGenerate}>Generate</button>
      {isStreaming && <button onClick={cancel}>Cancel</button>}
      <pre>{output}</pre>
    </div>
  );
}
```

## Configuration

### Environment Variables

**Frontend:** (`.env`)
```bash
VITE_API_URL=https://your-app.api.lp.dev
```

**Backend:** (Encore Secrets)
```bash
# Set via Encore CLI or Settings UI
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...
OLLAMA_URL=http://localhost:11434
JWT_SECRET=your-secret-here
```

### Storage Quota Settings

Edit `/frontend/db/schema.ts`:
```typescript
async pruneOldData(keepDays: number = 90) {
  // Change keepDays to adjust retention
  // Change 200 to adjust max deployment count
  const totalDeployments = await this.deployments.count();
  if (totalDeployments > 200) {
    // ...
  }
}
```

## Performance Optimization

### IndexedDB Compound Indexes

```typescript
// Optimized for common queries
this.version(2).stores({
  deployments: 'id, [status+created_at], project_id, created_at, synced',
  sync_events: 'id, [synced+timestamp], timestamp, entity, synced',
});

// Fast query example
const recentFailures = await db.deployments
  .where('[status+created_at]')
  .between(['failed', startDate], ['failed', endDate])
  .toArray();
```

### Bundle Splitting

Configured in `vite.config.ts`:
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom'],
        'ui-vendor': ['dexie', 'eventemitter3'],
        'chart-vendor': ['recharts'],
      },
    },
  },
}
```

## Testing

### E2E Tests (Playwright)

```bash
# Run offline-first tests
npm run test:e2e -- offline_sync.spec.ts

# Run LLM streaming tests
npm run test:e2e -- llm_streaming.spec.ts
```

### Unit Tests (Vitest)

```bash
# Frontend tests
cd frontend && npm test

# Backend tests
cd backend && npm test
```

## Troubleshooting

### Storage Quota Exceeded

**Symptoms:** App stops caching data, sync fails

**Solution:**
```typescript
// Clear old data
await db.pruneOldData(30); // Keep last 30 days

// Request persistent storage
if ('storage' in navigator && 'persist' in navigator.storage) {
  const granted = await navigator.storage.persist();
  console.log('Persistent storage:', granted);
}
```

### Sync Conflicts Not Resolving

**Symptoms:** Pending conflicts stuck

**Solution:**
```typescript
// Manually resolve all conflicts with "server wins"
const conflicts = await db.sync_conflicts
  .where('resolution')
  .equals('pending')
  .toArray();

for (const conflict of conflicts) {
  await db.sync_conflicts.update(conflict.id, {
    resolution: 'remote-wins',
    resolved_at: new Date().toISOString(),
  });
}
```

### LLM Rate Limit Errors

**Symptoms:** HTTP 429 responses

**Solution:**
- Wait 60 seconds for rate limit reset
- Use `gemini` provider as fallback
- Reduce request frequency

## Best Practices

1. **Always use optimistic updates** for better UX
2. **Monitor storage quota** and show warnings
3. **Handle offline state** in all user flows
4. **Test sync conflicts** with multiple browser tabs
5. **Sanitize LLM output** before rendering (XSS prevention)
6. **Rate limit aggressively** to prevent abuse
7. **Log all sync errors** for debugging

## Migration from Server-First

If migrating from a traditional server-first app:

1. **Wrap existing API calls** with optimistic mutations
2. **Seed IndexedDB** with initial data on first load
3. **Enable offline mode** gradually by feature
4. **Monitor sync performance** with metrics
5. **Add conflict resolution UI** for critical entities

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│          Browser (React)                │
│  ┌─────────────────────────────────┐   │
│  │   UI Components                 │   │
│  │   - CodeGeneratorPanel          │   │
│  │   - ConflictResolutionModal     │   │
│  │   - SyncStatusIndicator         │   │
│  └──────────┬──────────────────────┘   │
│             │                           │
│  ┌──────────▼──────────────────────┐   │
│  │   Hooks Layer                   │   │
│  │   - useLLMStream                │   │
│  │   - useOptimisticMutation       │   │
│  │   - useWebSocket                │   │
│  └──────────┬──────────────────────┘   │
│             │                           │
│  ┌──────────▼──────────────────────┐   │
│  │   Dexie.js (IndexedDB)          │   │
│  │   - Deployments (200 max)       │   │
│  │   - Projects                    │   │
│  │   - Sync Events                 │   │
│  └──────────┬──────────────────────┘   │
│             │                           │
│  ┌──────────▼──────────────────────┐   │
│  │   Sync Engine                   │   │
│  │   - CRDT Merge                  │   │
│  │   - Conflict Detection          │   │
│  │   - Exponential Backoff         │   │
│  └──────────┬──────────────────────┘   │
└─────────────┼─────────────────────────┘
              │
              │ HTTP (Poll every 30s)
              │
┌─────────────▼─────────────────────────┐
│      Encore.ts Backend                │
│  ┌───────────────────────────────┐   │
│  │   /sync/push                  │   │
│  │   /sync/pull                  │   │
│  │   /llm/generate (SSE)         │   │
│  └───────────────────────────────┘   │
│                                       │
│  ┌───────────────────────────────┐   │
│  │   PostgreSQL                  │   │
│  │   - Deployments               │   │
│  │   - Sync Events               │   │
│  │   - Conflicts                 │   │
│  └───────────────────────────────┘   │
└───────────────────────────────────────┘
```

## Further Reading

- [Dexie.js Documentation](https://dexie.org/)
- [IndexedDB Best Practices](https://web.dev/indexeddb-best-practices/)
- [CRDT Research](https://crdt.tech/)
- [Service Workers Guide](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
