import { FullConfig } from '@playwright/test';
import { cleanupTestData } from './cleanup-data';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test cleanup...');
  
  const apiURL = process.env.API_URL || config.use?.baseURL?.replace('.lp.dev', '.api.lp.dev');
  
  if (!apiURL) {
    console.warn('⚠️  API_URL not configured, skipping cleanup');
    return;
  }

  try {
    await cleanupTestData(apiURL);
    console.log('✅ E2E test cleanup completed');
  } catch (error) {
    console.error('❌ E2E test cleanup failed:', error);
  }
}

export default globalTeardown;
