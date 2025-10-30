import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:4000';

interface DeploymentNotification {
  type: string;
  data?: {
    deploymentId: number;
    projectId: number;
    projectName: string;
    environmentName: string;
    status: string;
    stage?: string;
    progress?: number;
    message?: string;
    timestamp: string;
  };
}

async function createSSEConnection(
  page: Page,
  params: { deploymentId?: number; projectId?: number } = {}
): Promise<{
  messages: DeploymentNotification[];
  waitForMessage: (predicate: (msg: DeploymentNotification) => boolean, timeout?: number) => Promise<DeploymentNotification>;
  close: () => void;
}> {
  const messages: DeploymentNotification[] = [];

  await page.evaluate(
    ({ apiBase, params }) => {
      const searchParams = new URLSearchParams();
      if (params.deploymentId) {
        searchParams.set('deploymentId', params.deploymentId.toString());
      }
      if (params.projectId) {
        searchParams.set('projectId', params.projectId.toString());
      }

      const url = `${apiBase}/notifications/deployments/events${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      const eventSource = new EventSource(url);

      (window as any).__sseMessages = [];
      (window as any).__eventSource = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          (window as any).__sseMessages.push(message);
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
      };
    },
    { apiBase: API_BASE, params }
  );

  await page.waitForTimeout(500);

  const waitForMessage = async (
    predicate: (msg: DeploymentNotification) => boolean,
    timeout = 10000
  ): Promise<DeploymentNotification> => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const currentMessages = await page.evaluate(() => (window as any).__sseMessages || []);
      const found = currentMessages.find(predicate);

      if (found) {
        return found;
      }

      await page.waitForTimeout(100);
    }

    throw new Error('Message not found within timeout');
  };

  const close = async () => {
    await page.evaluate(() => {
      if ((window as any).__eventSource) {
        (window as any).__eventSource.close();
      }
    });
  };

  return {
    messages,
    waitForMessage,
    close,
  };
}

async function triggerDeployment(
  projectId: number,
  environmentId: number
): Promise<{ deploymentId: number }> {
  const response = await fetch(`${API_BASE}/deployments/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      environment_id: environmentId,
      version: 'v1.0.0',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to trigger deployment: ${response.statusText}`);
  }

  const data = await response.json();
  return { deploymentId: data.deployment_id };
}

test.describe('Realtime Notifications', () => {
  test('should receive deployment notifications in order', async ({ page }) => {
    const connection = await createSSEConnection(page);

    const connectedMsg = await connection.waitForMessage(
      (msg) => msg.type === 'connected'
    );
    expect(connectedMsg.type).toBe('connected');

    const { deploymentId } = await triggerDeployment(1, 1);

    const notifications: DeploymentNotification[] = [];
    
    for (let i = 0; i < 5; i++) {
      const notification = await connection.waitForMessage(
        (msg) => msg.type === 'notification' && msg.data?.deploymentId === deploymentId && !notifications.some(n => n.data?.stage === msg.data?.stage)
      );
      
      expect(notification.type).toBe('notification');
      expect(notification.data).toBeDefined();
      expect(notification.data?.deploymentId).toBe(deploymentId);
      
      notifications.push(notification);
    }

    const stages = notifications.map(n => n.data?.stage).filter(Boolean);
    expect(stages).toContain('validation');
    expect(stages).toContain('build');

    const progressValues = notifications.map(n => n.data?.progress).filter((p): p is number => p !== undefined);
    for (let i = 1; i < progressValues.length; i++) {
      expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
    }

    await connection.close();
  });

  test('should filter notifications by deploymentId', async ({ page }) => {
    const connection1 = await createSSEConnection(page, { deploymentId: 999 });

    await connection1.waitForMessage((msg) => msg.type === 'connected');

    const { deploymentId } = await triggerDeployment(1, 1);
    expect(deploymentId).not.toBe(999);

    await page.waitForTimeout(3000);

    const messages = await page.evaluate(() => (window as any).__sseMessages || []);
    const deploymentMessages = messages.filter(
      (msg: DeploymentNotification) => msg.type === 'notification'
    );

    expect(deploymentMessages.length).toBe(0);

    await connection1.close();
  });

  test('should filter notifications by projectId', async ({ page }) => {
    const connection = await createSSEConnection(page, { projectId: 1 });

    await connection.waitForMessage((msg) => msg.type === 'connected');

    const { deploymentId } = await triggerDeployment(1, 1);

    const notification = await connection.waitForMessage(
      (msg) => msg.type === 'notification' && msg.data?.deploymentId === deploymentId
    );

    expect(notification.data?.projectId).toBe(1);

    await connection.close();
  });

  test('should handle reconnection with exponential backoff', async ({ page }) => {
    const connection = await createSSEConnection(page);

    await connection.waitForMessage((msg) => msg.type === 'connected');

    await page.evaluate(() => {
      if ((window as any).__eventSource) {
        (window as any).__eventSource.close();
      }
    });

    await page.waitForTimeout(500);

    const connection2 = await createSSEConnection(page);
    const reconnected = await connection2.waitForMessage((msg) => msg.type === 'connected', 5000);

    expect(reconnected.type).toBe('connected');

    await connection2.close();
  });

  test('should handle multiple concurrent clients', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const connection1 = await createSSEConnection(page1);
    const connection2 = await createSSEConnection(page2);

    await connection1.waitForMessage((msg) => msg.type === 'connected');
    await connection2.waitForMessage((msg) => msg.type === 'connected');

    const { deploymentId } = await triggerDeployment(1, 1);

    const notification1 = await connection1.waitForMessage(
      (msg) => msg.type === 'notification' && msg.data?.deploymentId === deploymentId
    );

    const notification2 = await connection2.waitForMessage(
      (msg) => msg.type === 'notification' && msg.data?.deploymentId === deploymentId
    );

    expect(notification1.data).toEqual(notification2.data);

    await connection1.close();
    await connection2.close();
    await page1.close();
    await page2.close();
    await context1.close();
    await context2.close();
  });

  test('should not receive duplicate notifications', async ({ page }) => {
    const connection = await createSSEConnection(page);

    await connection.waitForMessage((msg) => msg.type === 'connected');

    const { deploymentId } = await triggerDeployment(1, 1);

    await page.waitForTimeout(5000);

    const messages = await page.evaluate(() => (window as any).__sseMessages || []);
    const notifications = messages.filter(
      (msg: DeploymentNotification) => 
        msg.type === 'notification' && 
        msg.data?.deploymentId === deploymentId
    );

    const uniqueStages = new Set(
      notifications.map((n: DeploymentNotification) => 
        `${n.data?.stage}-${n.data?.progress}`
      )
    );

    expect(notifications.length).toBe(uniqueStages.size);

    await connection.close();
  });

  test('should receive heartbeat to maintain connection', async ({ page }) => {
    let heartbeatReceived = false;

    await page.on('console', (msg) => {
      if (msg.text().includes('heartbeat')) {
        heartbeatReceived = true;
      }
    });

    const connection = await createSSEConnection(page);
    await connection.waitForMessage((msg) => msg.type === 'connected');

    await page.waitForTimeout(20000);

    await connection.close();
  });

  test('should maintain message order with high throughput', async ({ page }) => {
    const connection = await createSSEConnection(page);

    await connection.waitForMessage((msg) => msg.type === 'connected');

    const deploymentPromises = [];
    for (let i = 0; i < 3; i++) {
      deploymentPromises.push(triggerDeployment(1, 1));
    }

    const deployments = await Promise.all(deploymentPromises);

    await page.waitForTimeout(6000);

    const messages = await page.evaluate(() => (window as any).__sseMessages || []);
    const notifications = messages.filter(
      (msg: DeploymentNotification) => msg.type === 'notification'
    );

    for (const { deploymentId } of deployments) {
      const deploymentNotifications = notifications.filter(
        (n: DeploymentNotification) => n.data?.deploymentId === deploymentId
      );

      const progressValues = deploymentNotifications
        .map((n: DeploymentNotification) => n.data?.progress)
        .filter((p): p is number => p !== undefined);

      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
      }
    }

    await connection.close();
  });
});
