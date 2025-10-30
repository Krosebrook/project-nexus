/**
 * Test matchers for deployment logs and validation.
 * Provides tolerance for log phrase drift between runtime and tests.
 */

import { expect } from '@playwright/test';

export function expectLogsContainValidation(logs: string): void {
  const needles = [
    'Validating deployment configuration',
    'Starting validation...',
  ];
  const found = needles.some(n => logs.includes(n));
  
  if (!found) {
    throw new Error(
      `Expected validation log. Tried: ${needles.join(' | ')}\nLogs:\n${logs}`
    );
  }
}

export function expectLogsContainBuild(logs: string): void {
  const needles = [
    'Building project',
    'Build started',
  ];
  const found = needles.some(n => logs.includes(n));
  
  if (!found) {
    throw new Error(
      `Expected build log. Tried: ${needles.join(' | ')}\nLogs:\n${logs}`
    );
  }
}

export function expectLogsContainTests(logs: string): void {
  const needles = [
    'Running test suite',
    'Tests started',
  ];
  const found = needles.some(n => logs.includes(n));
  
  if (!found) {
    throw new Error(
      `Expected test log. Tried: ${needles.join(' | ')}\nLogs:\n${logs}`
    );
  }
}

export function expectLogsContainPhrase(logs: string, ...phrases: string[]): void {
  const found = phrases.some(p => logs.includes(p));
  
  if (!found) {
    throw new Error(
      `Expected logs to contain one of: ${phrases.join(' | ')}\nLogs:\n${logs}`
    );
  }
}
