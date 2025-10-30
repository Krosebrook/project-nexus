import projects from '../fixtures/testdata/projects.json';

export async function cleanupTestData(apiURL: string) {
  console.log('🧹 Cleaning up test data...');

  try {
    for (const project of projects) {
      await fetch(`${apiURL}/projects.delete/${project.id}`, {
        method: 'DELETE',
      }).catch(() => console.log(`Failed to delete project ${project.id}`));
    }

    console.log('✅ Test data cleaned up successfully');
  } catch (error) {
    console.error('❌ Failed to cleanup test data:', error);
  }
}
