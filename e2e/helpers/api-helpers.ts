const apiURL = process.env.API_URL || 'https://project-nexus-database-schema-d3eqmd482vjnoj28ngcg.api.lp.dev';

export class APIHelpers {
  static async getDeploymentStatus(deploymentId: string) {
    const response = await fetch(`${apiURL}/deployments.getStatus/${deploymentId}`);
    if (!response.ok) {
      throw new Error(`Failed to get deployment status: ${response.statusText}`);
    }
    return response.json();
  }

  static async createDeployment(data: any) {
    const response = await fetch(`${apiURL}/deployments.create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to create deployment: ${response.statusText}`);
    }
    return response.json();
  }

  static async approveDeployment(deploymentId: string, approverId: string = 'e2e-approver-1') {
    const response = await fetch(`${apiURL}/approvals.approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deploymentId, approverId }),
    });
    if (!response.ok) {
      throw new Error(`Failed to approve deployment: ${response.statusText}`);
    }
    return response.json();
  }

  static async triggerRollback(deploymentId: string, reason: string = 'E2E test rollback') {
    const response = await fetch(`${apiURL}/deployments.rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deploymentId, reason }),
    });
    if (!response.ok) {
      throw new Error(`Failed to trigger rollback: ${response.statusText}`);
    }
    return response.json();
  }

  static async waitForDeploymentState(deploymentId: string, expectedState: string, timeoutMs = 60000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getDeploymentStatus(deploymentId);
      
      if (status.state === expectedState || status.status === expectedState) {
        return status;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`Deployment did not reach state ${expectedState} within ${timeoutMs}ms`);
  }

  static async getDeploymentLogs(deploymentId: string) {
    const response = await fetch(`${apiURL}/deployments.getLogs/${deploymentId}`);
    if (!response.ok) {
      throw new Error(`Failed to get deployment logs: ${response.statusText}`);
    }
    return response.json();
  }
}
