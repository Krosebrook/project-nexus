import { api } from "encore.dev/api";
import db from "../db";

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskFactor {
  category: string;
  description: string;
  severity: RiskLevel;
  weight: number;
}

export interface AIRiskSuggestion {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

export interface DeploymentRiskAssessment {
  overallRisk: RiskLevel;
  riskScore: number;
  factors: RiskFactor[];
  suggestions: AIRiskSuggestion[];
  metadata: {
    filesChanged: number;
    deploymentTime: Date;
    recentFailures: number;
    isBreakingChange: boolean;
    trafficLevel: 'low' | 'medium' | 'high';
  };
}

export interface AssessRiskRequest {
  projectId: number;
  environment: string;
  filesChanged?: number;
  scheduledTime?: Date;
  commitHash?: string;
}

export interface AssessRiskResponse {
  assessment: DeploymentRiskAssessment;
}

async function analyzeDeploymentSize(filesChanged: number): Promise<RiskFactor | null> {
  if (filesChanged > 100) {
    return {
      category: 'deployment_size',
      description: `Large deployment with ${filesChanged} file changes detected`,
      severity: 'high',
      weight: 0.3
    };
  } else if (filesChanged > 50) {
    return {
      category: 'deployment_size',
      description: `Medium deployment with ${filesChanged} file changes`,
      severity: 'medium',
      weight: 0.15
    };
  }
  return null;
}

async function analyzeDeploymentTiming(scheduledTime: Date): Promise<RiskFactor | null> {
  const hour = scheduledTime.getHours();
  const day = scheduledTime.getDay();

  if (day === 5 && hour >= 14) {
    return {
      category: 'timing',
      description: 'Friday afternoon deployment - limited time for monitoring',
      severity: 'medium',
      weight: 0.2
    };
  }

  if (hour >= 22 || hour <= 6) {
    return {
      category: 'timing',
      description: 'Late night/early morning deployment - reduced monitoring coverage',
      severity: 'medium',
      weight: 0.15
    };
  }

  if (hour >= 9 && hour <= 17) {
    return {
      category: 'timing',
      description: 'Peak hours deployment - high user traffic',
      severity: 'medium',
      weight: 0.2
    };
  }

  return null;
}

async function analyzeRecentFailures(projectId: number): Promise<{ factor: RiskFactor | null; count: number }> {
  const recentDeployments = await db.queryAll<{ status: string }>`
    SELECT status
    FROM deployment_logs
    WHERE project_id = ${projectId}
      AND created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    LIMIT 10
  `;

  const failureCount = recentDeployments.filter((d: { status: string }) => d.status === 'failed').length;

  if (failureCount >= 3) {
    return {
      factor: {
        category: 'recent_failures',
        description: `${failureCount} failed deployments in the last 7 days`,
        severity: 'high',
        weight: 0.35
      },
      count: failureCount
    };
  } else if (failureCount >= 1) {
    return {
      factor: {
        category: 'recent_failures',
        description: `${failureCount} recent deployment failure(s)`,
        severity: 'medium',
        weight: 0.2
      },
      count: failureCount
    };
  }

  return { factor: null, count: 0 };
}

async function detectBreakingChanges(commitHash?: string): Promise<RiskFactor | null> {
  if (!commitHash) return null;

  return null;
}

function calculateRiskScore(factors: RiskFactor[]): number {
  const maxScore = 100;
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  
  const severityScores: Record<RiskLevel, number> = {
    low: 25,
    medium: 50,
    high: 75,
    critical: 100
  };

  const weightedScore = factors.reduce((sum, factor) => {
    return sum + (severityScores[factor.severity] * factor.weight);
  }, 0);

  return Math.min(Math.round(weightedScore), maxScore);
}

function determineOverallRisk(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function generateAISuggestions(
  factors: RiskFactor[],
  metadata: DeploymentRiskAssessment['metadata']
): AIRiskSuggestion[] {
  const suggestions: AIRiskSuggestion[] = [];

  const hasTimingIssue = factors.some(f => f.category === 'timing');
  const hasLargeDeployment = factors.some(f => f.category === 'deployment_size');
  const hasRecentFailures = factors.some(f => f.category === 'recent_failures');

  if (hasTimingIssue && metadata.deploymentTime.getDay() === 5) {
    suggestions.push({
      title: 'Avoid Friday Deployments',
      description: 'Consider deploying earlier in the week to allow more time for monitoring and fixes if issues arise.',
      priority: 'medium'
    });
  }

  if (hasTimingIssue && metadata.trafficLevel === 'high') {
    suggestions.push({
      title: 'Deploy During Off-Peak Hours',
      description: 'Schedule deployment after peak hours (after 7pm) to minimize impact on users.',
      priority: 'high'
    });
  }

  if (hasLargeDeployment) {
    suggestions.push({
      title: 'Run Additional Testing',
      description: `With ${metadata.filesChanged} file changes, run comprehensive integration and load tests before deploying.`,
      priority: 'high'
    });

    suggestions.push({
      title: 'Consider Staged Rollout',
      description: 'Use canary deployment to gradually roll out changes and monitor for issues.',
      priority: 'medium'
    });
  }

  if (hasRecentFailures) {
    suggestions.push({
      title: 'Review Previous Failures',
      description: `Analyze the ${metadata.recentFailures} recent failed deployment(s) to ensure similar issues are resolved.`,
      priority: 'high'
    });

    suggestions.push({
      title: 'Increase Monitoring',
      description: 'Set up enhanced monitoring and alerts for this deployment given recent failure history.',
      priority: 'medium'
    });
  }

  if (metadata.isBreakingChange) {
    suggestions.push({
      title: 'Breaking Change Detected',
      description: 'Coordinate with API consumers and ensure backward compatibility or migration plan.',
      priority: 'high'
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: 'Deployment Looks Good',
      description: 'No major risk factors detected. Proceed with standard deployment procedures.',
      priority: 'low'
    });
  }

  return suggestions;
}

export const assessRisk = api(
  { method: "POST", path: "/deployments/assess-risk", expose: true },
  async (req: AssessRiskRequest): Promise<AssessRiskResponse> => {
    const factors: RiskFactor[] = [];
    const scheduledTime = req.scheduledTime || new Date();

    if (req.filesChanged) {
      const sizeFactor = await analyzeDeploymentSize(req.filesChanged);
      if (sizeFactor) factors.push(sizeFactor);
    }

    const timingFactor = await analyzeDeploymentTiming(scheduledTime);
    if (timingFactor) factors.push(timingFactor);

    const { factor: failureFactor, count: failureCount } = await analyzeRecentFailures(req.projectId);
    if (failureFactor) factors.push(failureFactor);

    const breakingChangeFactor = await detectBreakingChanges(req.commitHash);
    if (breakingChangeFactor) factors.push(breakingChangeFactor);

    const riskScore = calculateRiskScore(factors);
    const overallRisk = determineOverallRisk(riskScore);

    const hour = scheduledTime.getHours();
    const trafficLevel: 'low' | 'medium' | 'high' = 
      (hour >= 9 && hour <= 17) ? 'high' : 
      (hour >= 7 && hour <= 22) ? 'medium' : 'low';

    const metadata: DeploymentRiskAssessment['metadata'] = {
      filesChanged: req.filesChanged || 0,
      deploymentTime: scheduledTime,
      recentFailures: failureCount,
      isBreakingChange: !!breakingChangeFactor,
      trafficLevel
    };

    const suggestions = generateAISuggestions(factors, metadata);

    const assessment: DeploymentRiskAssessment = {
      overallRisk,
      riskScore,
      factors,
      suggestions,
      metadata
    };

    await db.exec`
      INSERT INTO deployment_risk_assessments (
        project_id,
        environment,
        risk_level,
        risk_score,
        factors,
        suggestions,
        metadata
      ) VALUES (
        ${req.projectId},
        ${req.environment},
        ${overallRisk},
        ${riskScore},
        ${JSON.stringify(factors)},
        ${JSON.stringify(suggestions)},
        ${JSON.stringify(metadata)}
      )
    `;

    return { assessment };
  }
);
