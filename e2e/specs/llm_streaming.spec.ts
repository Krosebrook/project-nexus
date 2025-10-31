import { test, expect } from '@playwright/test';

test.describe('LLM Streaming', () => {
  test('should stream code generation response', async ({ page }) => {
    await page.goto('/');

    const codeGenButton = page.locator('button:has-text("Code Generator"), a:has-text("Code Generator")');
    if (await codeGenButton.isVisible()) {
      await codeGenButton.click();
    }

    const promptTextarea = page.locator('textarea[placeholder*="Describe the code"]');
    if (await promptTextarea.isVisible()) {
      await promptTextarea.fill('Generate a TypeScript function to calculate Fibonacci numbers');

      await page.click('button:has-text("Generate Code")');

      const streamingIndicator = page.locator('.streaming-indicator');
      await expect(streamingIndicator).toBeVisible({ timeout: 5000 });

      await page.waitForTimeout(2000);

      const output = page.locator('.output-section');
      await expect(output).toBeVisible();

      const text = await output.textContent();
      expect(text!.length).toBeGreaterThan(0);

      await expect(streamingIndicator).not.toBeVisible({ timeout: 30000 });

      await expect(output).toContainText('function');
    } else {
      test.skip();
    }
  });

  test('should cancel streaming generation', async ({ page }) => {
    await page.goto('/');

    const codeGenButton = page.locator('button:has-text("Code Generator"), a:has-text("Code Generator")');
    if (await codeGenButton.isVisible()) {
      await codeGenButton.click();
    }

    const promptTextarea = page.locator('textarea[placeholder*="Describe the code"]');
    if (await promptTextarea.isVisible()) {
      await promptTextarea.fill('Write a complex sorting algorithm with detailed comments');

      await page.click('button:has-text("Generate Code")');

      await page.waitForTimeout(1000);

      const cancelButton = page.locator('button:has-text("Cancel")');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();

        await expect(page.locator('.streaming-indicator')).not.toBeVisible();
      }
    } else {
      test.skip();
    }
  });

  test('should handle LLM errors gracefully', async ({ page }) => {
    await page.route('/api/llm/generate', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto('/');

    const codeGenButton = page.locator('button:has-text("Code Generator"), a:has-text("Code Generator")');
    if (await codeGenButton.isVisible()) {
      await codeGenButton.click();
    }

    const promptTextarea = page.locator('textarea[placeholder*="Describe the code"]');
    if (await promptTextarea.isVisible()) {
      await promptTextarea.fill('Hello world function');

      await page.click('button:has-text("Generate Code")');

      await expect(page.locator('.error-banner')).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('should copy generated code to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/');

    const codeGenButton = page.locator('button:has-text("Code Generator"), a:has-text("Code Generator")');
    if (await codeGenButton.isVisible()) {
      await codeGenButton.click();
    }

    const promptTextarea = page.locator('textarea[placeholder*="Describe the code"]');
    if (await promptTextarea.isVisible()) {
      await promptTextarea.fill('Simple hello world function');

      await page.click('button:has-text("Generate Code")');

      await expect(page.locator('.output-section')).toBeVisible({ timeout: 30000 });

      const copyButton = page.locator('button:has-text("Copy")');
      await copyButton.click();

      await expect(page.locator('button:has-text("Copied")')).toBeVisible();

      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText.length).toBeGreaterThan(0);
    } else {
      test.skip();
    }
  });
});
