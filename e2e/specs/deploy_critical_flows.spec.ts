import { test, expect } from '@playwright/test';
import { DeploymentHelpers } from '../helpers/deployment-helpers';
import { APIHelpers } from '../helpers/api-helpers';

test.describe('Deployment Critical Flows', () => {
  test.describe.configure({ mode: 'serial' });

  test('Full Success Flow: Create → Approve → Run → Finalize', async ({ page }) => {
    const helpers = new DeploymentHelpers(page);
    const projectId = 'e2e-proj-001';
    const deploymentId = 'e2e-deploy-success-001';

    await test.step('Navigate to project', async () => {
      await helpers.navigateToProject(projectId);
    });

    await test.step('Create deployment', async () => {
      await helpers.createDeployment({
        environment: 'staging',
        version: '2.0.0-success',
      });
    });

    await test.step('Verify deployment appears in pending state', async () => {
      await helpers.verifyDeploymentInList(deploymentId, 'pending_approval');
    });

    await test.step('Approve deployment', async () => {
      await helpers.approveDeployment(deploymentId);
    });

    await test.step('Wait for deployment to start', async () => {
      await helpers.waitForDeploymentStatus(deploymentId, 'in_progress', 30000);
    });

    await test.step('Verify deployment timeline shows progress', async () => {
      await helpers.verifyDeploymentTimeline([
        'created',
        'approved',
        'building',
        'testing',
        'deploying',
      ]);
    });

    await test.step('Wait for deployment to complete', async () => {
      await helpers.waitForDeploymentStatus(deploymentId, 'completed', 120000);
    });

    await test.step('Verify final status and timeline', async () => {
      const statusBadge = page.locator('[data-testid="deployment-status-badge"]');
      await expect(statusBadge).toContainText('completed', { ignoreCase: true });
      
      await helpers.verifyDeploymentTimeline([
        'created',
        'approved',
        'building',
        'testing',
        'deploying',
        'health_check',
        'finalized',
      ]);
    });

    await test.step('Verify deployment logs are available', async () => {
      const logs = await helpers.getDeploymentLogs(deploymentId);
      expect(logs).toContain('Deployment completed successfully');
    });
  });

  test('Rollback Flow: Deployment Fails → Auto Rollback', async ({ page }) => {
    const helpers = new DeploymentHelpers(page);
    const projectId = 'e2e-proj-002';
    const deploymentId = 'e2e-deploy-002';

    await test.step('Navigate and create deployment', async () => {
      await helpers.navigateToProject(projectId);
      await helpers.createDeployment({
        environment: 'staging',
        version: '2.0.0-fail',
      });
    });

    await test.step('Approve deployment', async () => {
      await helpers.approveDeployment(deploymentId);
    });

    await test.step('Wait for deployment to fail', async () => {
      await helpers.waitForDeploymentStatus(deploymentId, 'failed', 120000);
    });

    await test.step('Verify automatic rollback triggered', async () => {
      const statusBadge = page.locator('[data-testid="deployment-status-badge"]');
      await expect(statusBadge).toContainText('rolling back', { ignoreCase: true });
    });

    await test.step('Wait for rollback completion', async () => {
      await helpers.waitForDeploymentStatus(deploymentId, 'rolled_back', 120000);
    });

    await test.step('Verify rollback successful', async () => {
      await helpers.verifyRollbackSuccessful(deploymentId);
      
      const logs = await helpers.getDeploymentLogs(deploymentId);
      expect(logs).toContain('Rollback completed');
    });

    await test.step('Verify timeline shows rollback steps', async () => {
      await helpers.verifyDeploymentTimeline([
        'created',
        'approved',
        'failed',
        'rollback_initiated',
        'rollback_completed',
      ]);
    });
  });

  test('Manual Rollback Flow: Success → Manual Trigger Rollback', async ({ page }) => {
    const helpers = new DeploymentHelpers(page);
    const deploymentId = 'e2e-deploy-manual-rollback-001';

    await test.step('Create and complete successful deployment via API', async () => {
      const deployment = await APIHelpers.createDeployment({
        id: deploymentId,
        projectId: 'e2e-proj-001',
        environment: 'staging',
        version: '2.1.0',
        status: 'pending_approval',
      });
      
      await APIHelpers.approveDeployment(deploymentId);
      await APIHelpers.waitForDeploymentState(deploymentId, 'completed', 120000);
    });

    await test.step('Navigate to completed deployment', async () => {
      await helpers.navigateToDeployment(deploymentId);
      
      const statusBadge = page.locator('[data-testid="deployment-status-badge"]');
      await expect(statusBadge).toContainText('completed', { ignoreCase: true });
    });

    await test.step('Trigger manual rollback', async () => {
      await helpers.triggerRollback(deploymentId);
    });

    await test.step('Wait for rollback to complete', async () => {
      await helpers.waitForDeploymentStatus(deploymentId, 'rolled_back', 120000);
    });

    await test.step('Verify rollback successful', async () => {
      await helpers.verifyRollbackSuccessful(deploymentId);
    });
  });

  test('Transient Error with Retry Flow', async ({ page }) => {
    const helpers = new DeploymentHelpers(page);
    const projectId = 'e2e-proj-003';
    const deploymentId = 'e2e-deploy-003';

    await test.step('Create and approve deployment', async () => {
      await helpers.navigateToProject(projectId);
      await helpers.createDeployment({
        environment: 'staging',
        version: '2.0.0-retry',
      });
      await helpers.approveDeployment(deploymentId);
    });

    await test.step('Monitor deployment with retries', async () => {
      let retryCount = 0;
      const startTime = Date.now();
      const maxWaitTime = 180000;

      while (Date.now() - startTime < maxWaitTime) {
        const logs = await helpers.getDeploymentLogs(deploymentId);
        
        const retryMatches = logs.match(/Retry attempt (\d+)/g);
        if (retryMatches) {
          retryCount = retryMatches.length;
        }

        const status = await APIHelpers.getDeploymentStatus(deploymentId);
        if (status.state === 'completed' || status.status === 'completed') {
          break;
        }

        await page.waitForTimeout(3000);
      }

      expect(retryCount).toBeGreaterThan(0);
      expect(retryCount).toBeLessThanOrEqual(3);
    });

    await test.step('Verify eventual success after retries', async () => {
      await helpers.waitForDeploymentStatus(deploymentId, 'completed', 30000);
      
      const logs = await helpers.getDeploymentLogs(deploymentId);
      expect(logs).toContain('Retry attempt');
      expect(logs).toContain('Deployment completed successfully');
    });
  });

  test('Timeout Flow: Deployment Times Out → Rollback', async ({ page }) => {
    const helpers = new DeploymentHelpers(page);
    const projectId = 'e2e-proj-004';
    const deploymentId = 'e2e-deploy-004';

    await test.step('Create and approve deployment with short timeout', async () => {
      await helpers.navigateToProject(projectId);
      await helpers.createDeployment({
        environment: 'staging',
        version: '2.0.0-timeout',
      });
      await helpers.approveDeployment(deploymentId);
    });

    await test.step('Wait for timeout', async () => {
      await page.waitForTimeout(10000);
      
      const statusBadge = page.locator('[data-testid="deployment-status-badge"]');
      const statusText = await statusBadge.textContent();
      
      expect(statusText?.toLowerCase()).toMatch(/timeout|failed|rolling/);
    });

    await test.step('Verify timeout triggers rollback', async () => {
      await helpers.waitForDeploymentStatus(deploymentId, 'rolled_back', 120000);
      
      const logs = await helpers.getDeploymentLogs(deploymentId);
      expect(logs).toMatch(/timeout|timed out/i);
    });

    await test.step('Verify rollback completed successfully', async () => {
      await helpers.verifyRollbackSuccessful(deploymentId);
    });
  });

  test('Approval Rejection Flow: Create → Reject', async ({ page }) => {
    const helpers = new DeploymentHelpers(page);
    const projectId = 'e2e-proj-001';
    const deploymentId = 'e2e-deploy-reject-001';

    await test.step('Create deployment', async () => {
      await helpers.navigateToProject(projectId);
      await helpers.createDeployment({
        environment: 'staging',
        version: '2.0.0-reject',
      });
    });

    await test.step('Reject deployment', async () => {
      await helpers.navigateToDeployment(deploymentId);
      await page.click('[data-testid="reject-deployment-btn"]');
      
      const rejectDialog = page.locator('[data-testid="reject-confirmation-dialog"]');
      await expect(rejectDialog).toBeVisible();
      
      await page.fill('[data-testid="rejection-reason-input"]', 'E2E test rejection');
      await page.click('[data-testid="confirm-reject-btn"]');
      await expect(rejectDialog).toBeHidden();
    });

    await test.step('Verify deployment marked as rejected', async () => {
      const statusBadge = page.locator('[data-testid="deployment-status-badge"]');
      await expect(statusBadge).toContainText('rejected', { ignoreCase: true });
    });

    await test.step('Verify deployment cannot be approved after rejection', async () => {
      const approveButton = page.locator('[data-testid="approve-deployment-btn"]');
      await expect(approveButton).toBeDisabled();
    });
  });

  test('Parallel Deployments: Multiple Projects Deploy Concurrently', async ({ page, context }) => {
    const helpers = new DeploymentHelpers(page);
    const deploymentIds = ['e2e-deploy-parallel-001', 'e2e-deploy-parallel-002'];

    await test.step('Create multiple deployments', async () => {
      await APIHelpers.createDeployment({
        id: deploymentIds[0],
        projectId: 'e2e-proj-001',
        environment: 'staging',
        version: '3.0.0',
      });

      await APIHelpers.createDeployment({
        id: deploymentIds[1],
        projectId: 'e2e-proj-002',
        environment: 'staging',
        version: '3.0.1',
      });
    });

    await test.step('Approve both deployments', async () => {
      await Promise.all([
        APIHelpers.approveDeployment(deploymentIds[0]),
        APIHelpers.approveDeployment(deploymentIds[1]),
      ]);
    });

    await test.step('Monitor both deployments progress', async () => {
      await page.goto('/');
      await page.click('[data-testid="deployments-tab"]');
      
      for (const deploymentId of deploymentIds) {
        const deploymentRow = page.locator(`[data-testid="deployment-row-${deploymentId}"]`);
        await expect(deploymentRow).toBeVisible();
        
        const statusBadge = deploymentRow.locator('[data-testid="status-badge"]');
        await expect(statusBadge).toContainText(/in_progress|running|deploying/i);
      }
    });

    await test.step('Wait for both to complete', async () => {
      await Promise.all([
        APIHelpers.waitForDeploymentState(deploymentIds[0], 'completed', 180000),
        APIHelpers.waitForDeploymentState(deploymentIds[1], 'completed', 180000),
      ]);
    });

    await test.step('Verify both completed successfully', async () => {
      await page.reload();
      
      for (const deploymentId of deploymentIds) {
        await helpers.verifyDeploymentInList(deploymentId, 'completed');
      }
    });
  });
});
