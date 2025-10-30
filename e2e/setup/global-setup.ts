import { FullConfig } from '@playwright/test';
import { seedTestData } from './seed-data';

async function globalSetup(config: FullConfig) {
  console.log('🌱 Starting E2E test setup...');
  
  const baseURL = config.use?.baseURL || process.env.BASE_URL;
  const apiURL = process.env.API_URL || baseURL?.replace('.lp.dev', '.api.lp.dev');
  
  if (!baseURL || !apiURL) {
    throw new Error('BASE_URL and API_URL must be configured');
  }

  console.log(`📍 Frontend URL: ${baseURL}`);
  console.log(`📍 API URL: ${apiURL}`);

  try {
    await waitForServices(baseURL, apiURL);
    await seedTestData(apiURL);
    console.log('✅ E2E test setup completed');
  } catch (error) {
    console.error('❌ E2E test setup failed:', error);
    throw error;
  }
}

async function waitForServices(frontendURL: string, apiURL: string, maxAttempts = 30) {
  console.log('⏳ Waiting for services to be ready...');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const [frontendResponse, apiResponse] = await Promise.all([
        fetch(frontendURL, { method: 'HEAD' }),
        fetch(`${apiURL}/health`, { method: 'GET' }).catch(() => null),
      ]);

      if (frontendResponse.ok) {
        console.log('✅ Services are ready');
        return;
      }
    } catch (error) {
      console.log(`⏳ Attempt ${i + 1}/${maxAttempts} - Services not ready yet...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Services did not become ready in time');
}

export default globalSetup;
