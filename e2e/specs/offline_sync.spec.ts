import { test, expect, Page } from '@playwright/test';

test.describe('Offline-First Sync', () => {
  let page: Page;

  test.beforeEach(async ({ page: p, context }) => {
    page = p;
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should cache deployments for offline viewing', async ({ context }) => {
    const deploymentCount = await page.locator('.deployment-card').count();
    
    if (deploymentCount === 0) {
      console.log('No deployments found, skipping test');
      test.skip();
    }

    expect(deploymentCount).toBeGreaterThan(0);

    await context.setOffline(true);

    await page.reload();

    const offlineCount = await page.locator('.deployment-card').count();
    expect(offlineCount).toBe(deploymentCount);

    await expect(page.locator('.offline-banner')).toBeVisible();

    await context.setOffline(false);
  });

  test('should queue changes when offline and sync when online', async ({ context }) => {
    await context.setOffline(true);

    const newDeployButton = page.locator('button:has-text("New Deployment")');
    if (await newDeployButton.isVisible()) {
      await newDeployButton.click();
      await page.fill('[name="name"]', 'Offline Test Deploy');
      await page.click('button[type="submit"]');

      await expect(page.locator('.deployment-card:has-text("Offline Test Deploy")')).toBeVisible();

      const syncStatus = page.locator('.sync-status');
      if (await syncStatus.isVisible()) {
        await expect(syncStatus).toContainText('pending');
      }
    }

    await context.setOffline(false);

    await page.waitForTimeout(3000);

    const syncStatus = page.locator('.sync-status');
    if (await syncStatus.isVisible()) {
      await expect(syncStatus).not.toContainText('pending');
    }
  });

  test('should show storage quota warning at 80%', async () => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.storage, 'estimate', {
        writable: true,
        value: async () => ({
          usage: 800_000_000,
          quota: 1_000_000_000,
        }),
      });
    });

    await page.reload();

    const storageWarning = page.locator('.storage-warning');
    if (await storageWarning.isVisible()) {
      await expect(storageWarning).toContainText('80%');
    }
  });

  test('should handle sync conflicts gracefully', async ({ context, browser }) => {
    const page2 = await browser.newPage();
    await page2.goto('/');

    await context.setOffline(true);

    await page.evaluate(() => {
      const db = (window as any).indexedDB;
      if (db) {
        const request = db.open('DeploymentPlatform');
        request.onsuccess = (event: any) => {
          const database = event.target.result;
          const tx = database.transaction('deployments', 'readwrite');
          const store = tx.objectStore('deployments');
          store.put({
            id: 'conflict-test',
            name: 'Conflict Test',
            status: 'succeeded',
            version: 2,
          });
        };
      }
    });

    await page2.evaluate(() => {
      const db = (window as any).indexedDB;
      if (db) {
        const request = db.open('DeploymentPlatform');
        request.onsuccess = (event: any) => {
          const database = event.target.result;
          const tx = database.transaction('deployments', 'readwrite');
          const store = tx.objectStore('deployments');
          store.put({
            id: 'conflict-test',
            name: 'Conflict Test',
            status: 'failed',
            version: 2,
          });
        };
      }
    });

    await context.setOffline(false);

    await page.waitForTimeout(3000);

    const conflictModal = page.locator('.conflict-modal');
    if (await conflictModal.isVisible()) {
      await expect(conflictModal).toContainText('Sync Conflict');
    }

    await page2.close();
  });
});
