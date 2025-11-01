import { DEPLOYMENT_STAGES } from "../shared/constants";
import { LogPhrases } from "./log-catalog";
import { updateDeploymentStage, completeDeployment, getProjectById, getEnvironmentById } from "../db/queries";
import { broadcastDeploymentNotification } from "../notifications/sse";

interface DeploymentStage {
  name: string;
  progress: number;
  startLog?: string;
  doneLog?: string;
}

const STAGE_CONFIG: DeploymentStage[] = [
  { name: 'validation', progress: 10, startLog: LogPhrases.VALIDATING_START, doneLog: LogPhrases.VALIDATING_DONE },
  { name: 'build', progress: 25, startLog: LogPhrases.BUILD_START, doneLog: LogPhrases.BUILD_DONE },
  { name: 'testing', progress: 40, startLog: LogPhrases.TESTS_START, doneLog: LogPhrases.TESTS_DONE },
  { name: 'migration', progress: 60, startLog: LogPhrases.MIGRATIONS_START, doneLog: LogPhrases.MIGRATIONS_DONE },
  { name: 'deployment', progress: 75, startLog: LogPhrases.DEPLOY_START, doneLog: LogPhrases.DEPLOY_DONE },
  { name: 'health_check', progress: 90, startLog: LogPhrases.HEALTH_START, doneLog: LogPhrases.HEALTH_DONE },
  { name: 'complete', progress: 100 },
];

async function executeStage(
  deploymentId: number,
  projectId: number,
  environmentId: number,
  stage: DeploymentStage,
  projectName: string,
  environmentName: string
) {
  const stateSnapshot = {
    stage: stage.name,
    status: 'start',
    timestamp: new Date().toISOString(),
  };

  if (stage.startLog) {
    await updateDeploymentStage(
      deploymentId,
      stage.name,
      stage.progress,
      stage.startLog + '\n',
      stateSnapshot
    );
  } else {
    await updateDeploymentStage(deploymentId, stage.name, stage.progress);
  }

  await broadcastDeploymentNotification({
    deploymentId,
    projectId,
    projectName,
    environmentName,
    status: 'in_progress',
    stage: stage.name,
    progress: stage.progress,
    message: stage.startLog || `Deployment stage: ${stage.name}`,
    timestamp: new Date(),
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  if (stage.doneLog) {
    const doneSnapshot = {
      stage: stage.name,
      status: 'done',
      timestamp: new Date().toISOString(),
    };
    await updateDeploymentStage(
      deploymentId,
      stage.name,
      stage.progress,
      stage.doneLog + '\n',
      doneSnapshot
    );
  }
}

export async function executeDeployment(
  deploymentId: number,
  projectId: number,
  environmentId: number
): Promise<void> {
  const project = await getProjectById(projectId);
  const environment = await getEnvironmentById(environmentId);

  const projectName = project?.name || 'Unknown';
  const environmentName = environment?.name || 'Unknown';

  for (const stage of STAGE_CONFIG) {
    await executeStage(deploymentId, projectId, environmentId, stage, projectName, environmentName);
  }

  await completeDeployment(deploymentId, 'success');

  await broadcastDeploymentNotification({
    deploymentId,
    projectId,
    projectName,
    environmentName,
    status: 'success',
    progress: 100,
    message: 'Deployment completed successfully',
    timestamp: new Date(),
  });
}
