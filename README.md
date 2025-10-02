# Project Nexus Database Schema

A comprehensive project management and monitoring system built with Encore.ts and React.

## Features

- **Project Management**: Create, update, and track projects with health scores and metrics
- **Test Automation**: Run regression tests and monitor baselines
- **Observability**: Configure and manage alert rules for system monitoring
- **Context Management**: Save and restore development context snapshots
- **File Tracking**: Monitor file organization and refactoring history

## Architecture

### Backend (Encore.ts)

The backend is organized into separate services:

- **projects**: Project CRUD operations and metrics
- **tests**: Test case management and execution
- **alerts**: Alert rule configuration and monitoring
- **contexts**: Development context snapshots
- **files**: File move tracking
- **settings**: Application settings management

### Shared Utilities

- **Error Handling**: Comprehensive middleware in `backend/shared/middleware.ts`
- **Rate Limiting**: Request rate limiting in `backend/shared/rate-limit.ts`
- **Query Monitoring**: Database performance tracking in `backend/db/performance.ts`

### Frontend (React + TypeScript)

- **Component-based architecture** with shadcn/ui components
- **Optimistic updates** for better UX
- **Error handling** with custom hooks
- **Loading states** for all async operations
- **Type-safe API client** auto-generated from backend

## Testing

### Backend Tests

```bash
npm test -- backend
```

- Database connection pool tests
- API integration tests
- Individual service tests

### Frontend Tests

```bash
npm test -- frontend
```

- React component unit tests
- Hook tests
- Test setup with vitest and @testing-library/react

### Coverage

```bash
npm run test:coverage
```

## TypeScript

The project uses **strict mode** with comprehensive type checking:

- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noUncheckedIndexedAccess: true`
- `noFallthroughCasesInSwitch: true`

## Development

### Error Handling

All API endpoints use standardized error handling:

```typescript
import { handleError } from "../shared/middleware";

try {
  // API logic
} catch (error) {
  handleError(error, {
    endpoint: "endpointName",
    timestamp: new Date(),
  });
}
```

### Rate Limiting

Apply rate limiting to endpoints:

```typescript
import { checkRateLimit, defaultRateLimit } from "../shared/rate-limit";

checkRateLimit(`endpoint:${userId}`, defaultRateLimit);
```

### Query Monitoring

Monitor database query performance:

```typescript
import { monitorQuery } from "../db/performance";

await monitorQuery("queryName", async () => {
  return await db.queryAll`SELECT * FROM table`;
});
```

## API Client (Frontend)

The frontend uses a type-safe auto-generated API client:

```typescript
import backend from "~backend/client";
import { useAPIErrorHandler } from "@/lib/api-client";

const { handleError } = useAPIErrorHandler();

try {
  const { projects } = await backend.projects.list();
} catch (error) {
  handleError(error, "Failed to load projects");
}
```

## Best Practices

1. **Always use loading states** for async operations
2. **Handle errors gracefully** with user-friendly messages
3. **Apply rate limiting** to protect against abuse
4. **Monitor query performance** for optimization opportunities
5. **Write tests** for critical functionality
6. **Use TypeScript strict mode** for type safety
7. **Follow component patterns** established in the codebase
