# E2E Tests

Comprehensive Playwright-based end-to-end tests for Project Nexus deployment flows.

## Overview

This test suite covers critical deployment flows:
- ✅ Full Success Flow: Create → Approve → Run → Finalize
- 🔄 Rollback Flow: Deployment Fails → Auto Rollback
- 🛠️ Manual Rollback Flow: Success → Manual Trigger Rollback
- 🔁 Transient Error with Retry Flow
- ⏱️ Timeout Flow: Deployment Times Out → Rollback
- ❌ Approval Rejection Flow: Create → Reject
- 🔀 Parallel Deployments: Multiple Projects Deploy Concurrently

## Prerequisites

```bash
npm install
npx playwright install
```

## Running Tests

### Run all tests
```bash
npm run e2e
```

### Run with UI mode (for development)
```bash
npm run e2e:ui
```

### Run in headed mode (see browser)
```bash
npm run e2e:headed
```

### Debug specific test
```bash
npm run e2e:debug
```

### View test report
```bash
npm run e2e:report
```

### Run specific test file
```bash
npx playwright test e2e/specs/deploy_critical_flows.spec.ts
```

### Run specific test by name
```bash
npx playwright test -g "Full Success Flow"
```

## Project Structure

```
e2e/
├── fixtures/
│   └── testdata/          # Seed data for tests
│       ├── projects.json
│       ├── deployments.json
│       ├── environments.json
│       └── approval-rules.json
├── helpers/               # Test utilities
│   ├── deployment-helpers.ts
│   └── api-helpers.ts
├── setup/                 # Global setup/teardown
│   ├── global-setup.ts
│   ├── global-teardown.ts
│   ├── seed-data.ts
│   └── cleanup-data.ts
├── specs/                 # Test specifications
│   └── deploy_critical_flows.spec.ts
├── playwright.config.ts   # Playwright configuration
└── README.md
```

## Configuration

### Environment Variables

- `BASE_URL`: Frontend URL (default: preview URL)
- `API_URL`: Backend API URL (default: API preview URL)
- `CI`: Set to true in CI environment

### Test Configuration

Configured in `playwright.config.ts`:
- **Retries**: 2 in CI, 1 locally
- **Workers**: 4 parallel workers in CI
- **Timeout**: 60 seconds per test
- **Screenshots**: Only on failure
- **Videos**: Only on failure
- **Traces**: Retained on failure

### Browser Projects

Tests run on multiple browsers:
- Chromium (Desktop Chrome)
- Firefox (Desktop Firefox)
- WebKit (Desktop Safari)
- Mobile Chrome (Pixel 5)

## Test Data

Test data is seeded via `e2e/fixtures/testdata/` and includes:
- 4 test projects
- Pre-configured deployments for each flow
- Environment configurations
- Approval rules

Data is automatically seeded before tests and cleaned up after.

## Stable Selectors

All critical UI elements use `data-testid` attributes:

- `project-card-{id}` - Project cards
- `project-detail-modal` - Project detail modal
- `create-deployment-btn` - Deploy button
- `deploy-modal` - Deploy modal
- `environment-select` - Environment selector
- `create-deployment-submit` - Submit deployment button
- `deployment-row-{id}` - Deployment row in list
- `deployment-details-modal` - Deployment details modal
- `deployment-status-badge` - Status badge
- `rollback-btn` - Rollback button
- `rollback-confirmation-dialog` - Rollback confirmation
- `confirm-rollback-btn` - Confirm rollback button
- `view-logs-btn` - View logs button
- `logs-modal` - Logs modal
- `log-content` - Log content area
- `deployment-timeline` - Timeline visualization
- `timeline-step-{name}` - Individual timeline steps

## CI/CD Integration

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests
- Manual workflow dispatch

### Parallel Execution

Tests are sharded across 4 parallel jobs for faster execution.

### Artifacts

On failure, the following are uploaded:
- Screenshots
- Videos
- Trace files
- HTML test report

Artifacts are retained for 7 days.

### Merged Reports

After all shards complete, reports are merged and uploaded with 30-day retention.

## Writing New Tests

### Example Test Structure

```typescript
test('My new deployment test', async ({ page }) => {
  const helpers = new DeploymentHelpers(page);
  
  await test.step('Step 1: Description', async () => {
    // Test code
  });
  
  await test.step('Step 2: Description', async () => {
    // Test code
  });
});
```

### Using Helpers

```typescript
// UI Helpers
const helpers = new DeploymentHelpers(page);
await helpers.navigateToProject('project-id');
await helpers.createDeployment({ environment: 'staging', version: '1.0.0' });

// API Helpers
const status = await APIHelpers.getDeploymentStatus('deployment-id');
await APIHelpers.approveDeployment('deployment-id');
```

## Debugging

### Debug Mode

```bash
npm run e2e:debug
```

This opens the Playwright Inspector for step-by-step debugging.

### UI Mode

```bash
npm run e2e:ui
```

Interactive UI for running and debugging tests.

### Viewing Traces

After a test failure, traces are saved. View them:

```bash
npx playwright show-trace test-results/path/to/trace.zip
```

## Best Practices

1. **Use data-testid**: Always use stable selectors
2. **Test isolation**: Each test should be independent
3. **Descriptive steps**: Use `test.step()` for clarity
4. **Proper waits**: Use Playwright's auto-waiting, avoid fixed timeouts
5. **Clean assertions**: Use expect with specific matchers
6. **Error messages**: Include helpful error messages in assertions

## Troubleshooting

### Tests timing out
- Increase timeout in playwright.config.ts
- Check if services are running
- Review network requests in trace

### Flaky tests
- Review retry configuration
- Check for race conditions
- Use proper wait strategies

### CI failures
- Review uploaded artifacts
- Check service logs
- Verify environment variables

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
