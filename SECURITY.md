# Security Audit Report

## Offline-First Web Application Security

### XSS Prevention

**LLM Output Sanitization:**
- ✅ All LLM-generated code is rendered using `react-syntax-highlighter`
- ✅ Never uses `dangerouslySetInnerHTML` for LLM output
- ✅ Code is displayed in `<pre>` tags or syntax highlighter components
- ✅ All user inputs are escaped by React's default behavior

**Implementation:**
```typescript
// CodeGeneratorPanel.tsx - Safe rendering
<SyntaxHighlighter language="typescript" style={vscDarkPlus}>
  {output}
</SyntaxHighlighter>

// NEVER do this:
// <div dangerouslySetInnerHTML={{ __html: output }} />
```

### Rate Limiting

**Backend Implementation:**
- ✅ 10 requests per minute per user for LLM endpoints
- ✅ Rate limiter uses in-memory Map with auto-reset
- ✅ Returns HTTP 429 when limit exceeded
- ✅ Exponential backoff implemented in frontend

**Implementation:**
```typescript
// backend/llm/router.ts
private checkRateLimit(userId: string) {
  const now = Date.now();
  const userLimit = this.rateLimiter.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    this.rateLimiter.set(userId, { count: 1, resetAt: now + 60000 });
    return;
  }

  if (userLimit.count >= 10) {
    throw new APIError(429, 'Rate limit exceeded: 10 requests per minute');
  }

  userLimit.count++;
}
```

### Secrets Management

**Environment Variables:**
- ✅ API keys stored in Encore secrets (not in code)
- ✅ `ANTHROPIC_API_KEY` for Claude
- ✅ `GOOGLE_AI_API_KEY` for Gemini
- ✅ Never exposed to frontend

**Implementation:**
```typescript
// backend/llm/router.ts
import { Secret } from 'encore.dev/config';

const claudeApiKey = new Secret('ANTHROPIC_API_KEY');
const geminiApiKey = new Secret('GOOGLE_AI_API_KEY');
```

### Authentication & Authorization

**JWT Validation:**
- ✅ All sync endpoints require authentication
- ✅ LLM endpoints require valid auth token
- ✅ Rate limiting per authenticated user

**Implementation:**
```typescript
// backend/llm/generate.ts
export const generate = api.streamOut(
  { expose: true, method: 'POST', path: '/llm/generate', auth: true },
  async (req: LLMRequest): Promise<AsyncGenerator<string>> => {
    const userId = authHandler.userId();
    // ...
  }
);
```

### Input Validation

**LLM Prompts:**
- ✅ Prompt length validation (min 1 character)
- ✅ Max tokens capped at 2000
- ✅ Temperature constrained to 0.0-1.0 range

**Sync Events:**
- ✅ Event schema validation
- ✅ Version number validation
- ✅ Entity type whitelisting

**Implementation:**
```typescript
// backend/llm/generate.ts
if (!req.prompt || req.prompt.trim().length === 0) {
  throw new APIError(400, 'Prompt is required');
}
```

### CORS Configuration

**Settings:**
- ✅ Origin restricted to preview URL
- ✅ Credentials allowed for authenticated requests
- ✅ Methods limited to GET, POST
- ✅ Headers validated

**Note:** Encore.ts handles CORS automatically for exposed endpoints.

### Data Privacy

**Local Storage:**
- ✅ IndexedDB isolated per origin
- ✅ No PII stored in sync events
- ✅ Auto-pruning after 90 days
- ✅ User can clear all data

**Sync Protocol:**
- ✅ Client ID is anonymous UUID
- ✅ No sensitive data in conflict logs
- ✅ Version vectors don't leak user info

### Known Vulnerabilities & Mitigations

| Vulnerability | Risk | Mitigation |
|---------------|------|------------|
| **XSS via LLM Output** | High | Always render in `<pre>` or syntax highlighter |
| **Rate Limit Bypass** | Medium | Server-side enforcement, not client-side |
| **IndexedDB Eviction** | Low | Request persistent storage with `navigator.storage.persist()` |
| **CRDT Conflict Exploitation** | Medium | Server validates version vectors |
| **WebSocket Message Flood** | Medium | Rate limit WS messages (10/sec per connection) |

### Security Checklist

**Pre-Deployment:**
- [ ] Verify all API keys in Encore secrets
- [ ] Test rate limiting with load testing tool
- [ ] Run `npm audit` on frontend dependencies
- [ ] Verify CORS settings for production domain
- [ ] Test offline mode with malicious payloads
- [ ] Review all `dangerouslySetInnerHTML` usage (should be zero)
- [ ] Validate all user inputs on backend
- [ ] Enable HTTPS only in production

**Post-Deployment:**
- [ ] Monitor rate limit violations in logs
- [ ] Set up alerts for 429 responses
- [ ] Review sync conflict logs for anomalies
- [ ] Test authentication with expired tokens
- [ ] Verify secrets not exposed in browser DevTools

### Reporting Security Issues

If you discover a security vulnerability, please email: security@example.com

**Do not:**
- Create public GitHub issues for security bugs
- Share vulnerabilities in chat channels
- Exploit vulnerabilities in production

## Last Updated

2025-10-31
