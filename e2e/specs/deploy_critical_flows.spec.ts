import { test, expect } from '@playwright/test';
import { deployProject, waitForDeploymentCompletion, cleanupDeployments } from '../helpers/deployment-helpers';
import { getApiClient } from '../helpers/api-helpers';

test.describe('Critical Deployment Flows', () => {
  const api = getApiClient();

  test.beforeEach(async () => {
    await cleanupDeployments(api);
  });

  test.afterEach(async () => {
    await cleanupDeployments(api);
  });

  test('should create deployment and verify success status', async ({ page }) => {
    await page.goto('/');
    
    const projectCard = page.locator('[data-testid="project-card"]').first();
    await projectCard.click();

    await page.click('[data-testid="deploy-button"]');
    
    await page.fill('[data-testid="deployment-env-select"]', 'staging');
    
    await page.click('[data-testid="confirm-deploy-button"]');

    await expect(page.locator('[data-testid="deployment-status"]')).toContainText('running', { timeout: 10000 });

    await expect(page.locator('[data-testid="deployment-status"]')).toContainText('succeeded', { timeout: 30000 });

    const statusBadge = page.locator('[data-testid="deployment-status-badge"]');
    await expect(statusBadge).toHaveClass(/success|completed/);

    const deploymentId = await page.locator('[data-testid="deployment-id"]').textContent();
    
    const dbDeployment = await api.deployments.status({ deploymentId: deploymentId! });
    expect(dbDeployment.status).toBe('succeeded');
  });

  test('should handle deployment failure and verify rollback', async ({ page }) => {
    await page.goto('/');
    
    const projectCard = page.locator('[data-testid="project-card"]').first();
    await projectCard.click();

    await page.click('[data-testid="deploy-button"]');
    
    await page.check('[data-testid="force-failure-checkbox"]');
    
    await page.fill('[data-testid="deployment-env-select"]', 'staging');
    await page.click('[data-testid="confirm-deploy-button"]');

    await expect(page.locator('[data-testid="deployment-status"]')).toContainText('failed', { timeout: 30000 });

    await expect(page.locator('[data-testid="rollback-indicator"]')).toBeVisible();

    const rollbackMessage = page.locator('[data-testid="rollback-message"]');
    await expect(rollbackMessage).toContainText('rolled back');

    const deploymentId = await page.locator('[data-testid="deployment-id"]').textContent();
    
    const dbDeployment = await api.deployments.status({ deploymentId: deploymentId! });
    expect(dbDeployment.status).toBe('failed');
    expect(dbDeployment.rollback_completed).toBe(true);
  });

  test('should schedule deployment and verify queue position', async ({ page }) => {
    await page.goto('/');
    
    const projectCard = page.locator('[data-testid="project-card"]').first();
    await projectCard.click();

    await page.click('[data-testid="deploy-button"]');
    
    await page.click('[data-testid="schedule-deployment-tab"]');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    await page.fill('[data-testid="schedule-date"]', tomorrowStr);
    await page.fill('[data-testid="schedule-time"]', '14:00');
    
    await page.click('[data-testid="confirm-schedule-button"]');

    await expect(page.locator('[data-testid="deployment-queued-message"]')).toBeVisible();

    await page.goto('/deployments/queue');

    const queuedItem = page.locator('[data-testid="queued-deployment"]').first();
    await expect(queuedItem).toBeVisible();
    
    const queuePosition = await queuedItem.locator('[data-testid="queue-position"]').textContent();
    expect(parseInt(queuePosition!)).toBeGreaterThanOrEqual(1);

    await queuedItem.locator('[data-testid="cancel-deployment-button"]').click();
    await page.locator('[data-testid="confirm-cancel-button"]').click();

    await expect(queuedItem).not.toBeVisible({ timeout: 5000 });
  });

  test('should enforce dependency order in deployments', async ({ page }) => {
    await page.goto('/projects');

    const apiProject = page.locator('[data-testid="project-card"]', { hasText: 'API Service' });
    await apiProject.click();

    await page.click('[data-testid="dependencies-tab"]');
    
    await page.click('[data-testid="add-dependency-button"]');
    await page.fill('[data-testid="dependency-name"]', 'Database Service');
    await page.click('[data-testid="save-dependency-button"]');

    await page.goto('/');
    
    await page.click('[data-testid="bulk-deploy-button"]');
    
    await page.check('[data-testid="project-checkbox"][data-project="database-service"]');
    await page.check('[data-testid="project-checkbox"][data-project="api-service"]');
    
    await page.click('[data-testid="deploy-selected-button"]');

    const deploymentOrder = page.locator('[data-testid="deployment-order-list"]');
    const firstItem = deploymentOrder.locator('li').first();
    const secondItem = deploymentOrder.locator('li').nth(1);

    await expect(firstItem).toContainText('Database Service');
    await expect(secondItem).toContainText('API Service');

    await page.click('[data-testid="confirm-bulk-deploy-button"]');

    await expect(page.locator('[data-testid="deployment-progress"]')).toBeVisible();
  });

  test('should promote deployment from staging to production', async ({ page }) => {
    await page.goto('/');
    
    const projectCard = page.locator('[data-testid="project-card"]').first();
    const projectName = await projectCard.locator('[data-testid="project-name"]').textContent();
    await projectCard.click();

    await page.click('[data-testid="deploy-button"]');
    await page.fill('[data-testid="deployment-env-select"]', 'staging');
    await page.click('[data-testid="confirm-deploy-button"]');

    await expect(page.locator('[data-testid="deployment-status"]')).toContainText('succeeded', { timeout: 30000 });

    const stagingDeploymentId = await page.locator('[data-testid="deployment-id"]').textContent();

    await page.goto('/deployments');
    
    const stagingDeployment = page.locator(`[data-testid="deployment-${stagingDeploymentId}"]`);
    await stagingDeployment.locator('[data-testid="promote-button"]').click();

    await page.locator('[data-testid="promotion-env-select"]').selectOption('production');
    
    await page.check('[data-testid="run-smoke-tests-checkbox"]');
    
    await page.click('[data-testid="confirm-promotion-button"]');

    await expect(page.locator('[data-testid="promotion-status"]')).toContainText('running', { timeout: 10000 });

    await expect(page.locator('[data-testid="smoke-tests-status"]')).toContainText('passed', { timeout: 20000 });

    await expect(page.locator('[data-testid="promotion-status"]')).toContainText('succeeded', { timeout: 30000 });

    await page.goto(`/projects/${projectName}`);
    
    const prodDeployment = page.locator('[data-testid="production-deployment"]');
    await expect(prodDeployment).toBeVisible();
    await expect(prodDeployment).toContainText(stagingDeploymentId!);
  });
});
