import projects from '../fixtures/testdata/projects.json';
import deployments from '../fixtures/testdata/deployments.json';
import environments from '../fixtures/testdata/environments.json';
import approvalRules from '../fixtures/testdata/approval-rules.json';

export async function seedTestData(apiURL: string) {
  console.log('🌱 Seeding test data...');

  try {
    for (const project of projects) {
      await fetch(`${apiURL}/projects.create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      }).catch(() => console.log(`Project ${project.id} may already exist`));
    }

    for (const env of environments) {
      await fetch(`${apiURL}/deployments.createEnvironment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(env),
      }).catch(() => console.log(`Environment ${env.id} may already exist`));
    }

    for (const rule of approvalRules) {
      await fetch(`${apiURL}/approvals.createRule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      }).catch(() => console.log(`Approval rule ${rule.id} may already exist`));
    }

    for (const deployment of deployments) {
      await fetch(`${apiURL}/deployments.create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deployment),
      }).catch(() => console.log(`Deployment ${deployment.id} may already exist`));
    }

    console.log('✅ Test data seeded successfully');
  } catch (error) {
    console.error('❌ Failed to seed test data:', error);
    throw error;
  }
}
