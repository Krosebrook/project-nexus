import { Page, expect } from '@playwright/test';

export async function deployProject(
  api: any,
  projectId: string,
  environment: string = 'staging',
  options: { forceFailure?: boolean; schedule?: Date } = {}
): Promise<{ deploymentId: string }> {
  const response = await api.deployments.deploy({
    projectId,
    environment,
    forceFailure: options.forceFailure || false,
    scheduledFor: options.schedule?.toISOString()
  });

  return { deploymentId: response.id };
}

export async function waitForDeploymentCompletion(
  api: any,
  deploymentId: string,
  timeout: number = 30000
): Promise<{ status: string; duration: number }> {
  const startTime = Date.now();
  const endTime = startTime + timeout;

  while (Date.now() < endTime) {
    const status = await api.deployments.status({ deploymentId });
    
    if (['succeeded', 'failed', 'cancelled'].includes(status.status)) {
      return {
        status: status.status,
        duration: Date.now() - startTime
      };
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Deployment ${deploymentId} did not complete within ${timeout}ms`);
}

export async function cleanupDeployments(api: any): Promise<void> {
  try {
    const activeDeployments = await api.deployments.list({ status: 'running' });
    
    for (const deployment of activeDeployments) {
      try {
        await api.deployments.cancel({ deploymentId: deployment.id });
      } catch (error) {
      }
    }
  } catch (error) {
  }
}

export class DeploymentHelpers {
  constructor(private page: Page) {}

  async navigateToProject(projectId: string) {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
    await this.page.click(`[data-testid="project-card-${projectId}"]`, { timeout: 10000 });
    await expect(this.page.locator('[data-testid="project-detail-modal"]')).toBeVisible();
  }

  async createDeployment(config: {
    environment: string;
    version: string;
  }) {
    await this.page.click('[data-testid="create-deployment-btn"]');
    await expect(this.page.locator('[data-testid="deploy-modal"]')).toBeVisible();

    await this.page.fill('[data-testid="deployment-version-input"]', config.version);
    await this.page.selectOption('[data-testid="environment-select"]', config.environment);
    
    await this.page.click('[data-testid="create-deployment-submit"]');
    await expect(this.page.locator('[data-testid="deploy-modal"]')).toBeHidden();
  }

  async approveDeployment(deploymentId: string) {
    await this.navigateToDeployment(deploymentId);
    await this.page.click('[data-testid="approve-deployment-btn"]');
    
    const approveDialog = this.page.locator('[data-testid="approve-confirmation-dialog"]');
    await expect(approveDialog).toBeVisible();
    
    await this.page.click('[data-testid="confirm-approve-btn"]');
    await expect(approveDialog).toBeHidden();
  }

  async navigateToDeployment(deploymentId: string) {
    await this.page.goto('/');
    await this.page.click('[data-testid="deployments-tab"]');
    await this.page.click(`[data-testid="deployment-row-${deploymentId}"]`);
    await expect(this.page.locator('[data-testid="deployment-details-modal"]')).toBeVisible();
  }

  async waitForDeploymentStatus(deploymentId: string, expectedStatus: string, timeoutMs = 60000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      await this.page.reload();
      await this.navigateToDeployment(deploymentId);
      
      const statusBadge = this.page.locator('[data-testid="deployment-status-badge"]');
      const currentStatus = await statusBadge.textContent();
      
      if (currentStatus?.toLowerCase().includes(expectedStatus.toLowerCase())) {
        return;
      }
      
      await this.page.waitForTimeout(2000);
    }
    
    throw new Error(`Deployment ${deploymentId} did not reach status ${expectedStatus} within ${timeoutMs}ms`);
  }

  async triggerRollback(deploymentId: string) {
    await this.navigateToDeployment(deploymentId);
    await this.page.click('[data-testid="rollback-btn"]');
    
    const rollbackDialog = this.page.locator('[data-testid="rollback-confirmation-dialog"]');
    await expect(rollbackDialog).toBeVisible();
    
    await this.page.click('[data-testid="confirm-rollback-btn"]');
    await expect(rollbackDialog).toBeHidden();
  }

  async verifyDeploymentInList(deploymentId: string, expectedStatus?: string) {
    await this.page.goto('/');
    await this.page.click('[data-testid="deployments-tab"]');
    
    const deploymentRow = this.page.locator(`[data-testid="deployment-row-${deploymentId}"]`);
    await expect(deploymentRow).toBeVisible();
    
    if (expectedStatus) {
      const statusBadge = deploymentRow.locator('[data-testid="status-badge"]');
      await expect(statusBadge).toContainText(expectedStatus);
    }
  }

  async verifyDeploymentTimeline(expectedSteps: string[]) {
    const timeline = this.page.locator('[data-testid="deployment-timeline"]');
    await expect(timeline).toBeVisible();
    
    for (const step of expectedSteps) {
      const timelineStep = this.page.locator(`[data-testid="timeline-step-${step}"]`);
      await expect(timelineStep).toBeVisible();
    }
  }

  async getDeploymentLogs(deploymentId: string) {
    await this.navigateToDeployment(deploymentId);
    await this.page.click('[data-testid="view-logs-btn"]');
    
    const logsModal = this.page.locator('[data-testid="logs-modal"]');
    await expect(logsModal).toBeVisible();
    
    const logs = await this.page.locator('[data-testid="log-content"]').textContent();
    
    await this.page.click('[data-testid="close-logs-modal"]');
    
    return logs || '';
  }

  async verifyRollbackSuccessful(deploymentId: string) {
    await this.waitForDeploymentStatus(deploymentId, 'rolled_back', 60000);
    
    const statusBadge = this.page.locator('[data-testid="deployment-status-badge"]');
    await expect(statusBadge).toContainText('rolled back', { ignoreCase: true });
  }
}
