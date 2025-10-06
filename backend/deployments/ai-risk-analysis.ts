import { api } from "encore.dev/api";
import db from "../db";
import type { RiskFactor, DeploymentRiskAssessment } from "./risk-assessment";

interface AIRiskAnalysisRequest {
  project_id: number;
  environment_id: number;
  deployment_metadata?: Record<string, any>;
  code_changes?: {
    files_changed: number;
    lines_added: number;
    lines_removed: number;
    critical_files_changed: string[];
  };
}

interface AIRiskInsight {
  insight: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  evidence: string[];
}

interface AIRiskAnalysisResponse extends DeploymentRiskAssessment {
  ai_insights: AIRiskInsight[];
  predicted_failure_probability: number;
  similar_deployments_success_rate: number;
  confidence_score: number;
}

function analyzeCodeChangePatterns(changes?: {
  files_changed: number;
  lines_added: number;
  lines_removed: number;
  critical_files_changed: string[];
}): AIRiskInsight[] {
  const insights: AIRiskInsight[] = [];

  if (!changes) {
    return insights;
  }

  if (changes.files_changed > 50) {
    insights.push({
      insight: 'Large number of files changed detected',
      severity: 'high',
      confidence: 0.85,
      evidence: [
        `${changes.files_changed} files changed`,
        'Large changesets are correlated with higher failure rates',
        'Consider splitting into smaller deployments',
      ],
    });
  }

  const changeRatio = changes.lines_added / (changes.lines_removed || 1);
  if (changeRatio > 5 && changes.lines_added > 1000) {
    insights.push({
      insight: 'Significant code expansion detected',
      severity: 'medium',
      confidence: 0.72,
      evidence: [
        `${changes.lines_added} lines added vs ${changes.lines_removed} removed`,
        'Large code additions may introduce unexpected behavior',
        'Ensure comprehensive testing coverage',
      ],
    });
  }

  if (changes.critical_files_changed.length > 0) {
    insights.push({
      insight: 'Critical infrastructure files modified',
      severity: 'high',
      confidence: 0.9,
      evidence: [
        `Modified files: ${changes.critical_files_changed.join(', ')}`,
        'Changes to core files require extra validation',
        'Recommend manual review and staged rollout',
      ],
    });
  }

  return insights;
}

async function analyzeHistoricalPatterns(
  projectId: number,
  environmentId: number
): Promise<{
  failureProbability: number;
  successRate: number;
  insights: AIRiskInsight[];
}> {
  const recentDeployments = await db.queryAll<{
    id: number;
    status: string;
    error_message: string | null;
    metadata: any;
    created_at: Date;
  }>`
    SELECT id, status, error_message, metadata, created_at
    FROM deployment_logs
    WHERE project_id = ${projectId}
      AND environment_id = ${environmentId}
      AND created_at > NOW() - INTERVAL '30 days'
    ORDER BY created_at DESC
    LIMIT 50
  `;

  const total = recentDeployments.length;
  const successful = recentDeployments.filter(d => d.status === 'success').length;
  const failed = recentDeployments.filter(d => d.status === 'failed').length;

  const successRate = total > 0 ? (successful / total) * 100 : 100;
  const failureProbability = total > 0 ? (failed / total) * 100 : 0;

  const insights: AIRiskInsight[] = [];

  if (successRate < 70) {
    insights.push({
      insight: 'Low historical success rate detected',
      severity: 'critical',
      confidence: 0.95,
      evidence: [
        `Success rate: ${successRate.toFixed(1)}% over last 30 days`,
        `${failed} out of ${total} deployments failed`,
        'Indicates systemic issues requiring investigation',
      ],
    });
  } else if (successRate < 90) {
    insights.push({
      insight: 'Moderate deployment stability concerns',
      severity: 'medium',
      confidence: 0.8,
      evidence: [
        `Success rate: ${successRate.toFixed(1)}% over last 30 days`,
        'Recent deployment pattern shows room for improvement',
      ],
    });
  }

  const errorPatterns = recentDeployments
    .filter(d => d.error_message)
    .reduce((acc, d) => {
      const errorType = d.error_message?.split(':')[0] || 'Unknown';
      acc[errorType] = (acc[errorType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const repeatedErrors = Object.entries(errorPatterns)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a);

  if (repeatedErrors.length > 0) {
    insights.push({
      insight: 'Recurring error patterns identified',
      severity: 'high',
      confidence: 0.88,
      evidence: [
        `Top error: ${repeatedErrors[0][0]} (occurred ${repeatedErrors[0][1]} times)`,
        'Recurring errors suggest unresolved underlying issues',
        'Review and address root causes before deploying',
      ],
    });
  }

  return {
    failureProbability,
    successRate,
    insights,
  };
}

async function analyzeTimeBasedRisks(
  projectId: number,
  environmentId: number
): Promise<AIRiskInsight[]> {
  const insights: AIRiskInsight[] = [];
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();

  if (dayOfWeek === 5 && hour >= 15) {
    insights.push({
      insight: 'High-risk deployment window: Friday afternoon',
      severity: 'medium',
      confidence: 0.75,
      evidence: [
        'Friday afternoon deployments have limited time for issue resolution',
        'Weekend support availability may be reduced',
        'Consider deploying earlier in the week',
      ],
    });
  }

  if (hour >= 22 || hour < 6) {
    insights.push({
      insight: 'Deploying during off-hours',
      severity: 'low',
      confidence: 0.65,
      evidence: [
        'Off-hours deployment may have reduced team availability',
        'Consider scheduling for business hours unless urgent',
      ],
    });
  }

  const recentPeakLoad = await db.queryRow<{ metric_value: number | null }>`
    SELECT metric_value
    FROM project_metrics
    WHERE project_id = ${projectId}
      AND metric_name = 'request_rate'
      AND created_at > NOW() - INTERVAL '1 hour'
    ORDER BY metric_value DESC
    LIMIT 1
  `;

  if (recentPeakLoad && recentPeakLoad.metric_value && recentPeakLoad.metric_value > 1000) {
    insights.push({
      insight: 'High traffic period detected',
      severity: 'high',
      confidence: 0.82,
      evidence: [
        `Current request rate: ${recentPeakLoad.metric_value.toFixed(0)} req/min`,
        'Deploying during peak traffic increases user impact risk',
        'Consider waiting for lower traffic period',
      ],
    });
  }

  return insights;
}

export const analyzeDeploymentRiskWithAI = api(
  { method: "POST", path: "/deployments/ai-risk-analysis", expose: true },
  async (req: AIRiskAnalysisRequest): Promise<AIRiskAnalysisResponse> => {
    const codeInsights = analyzeCodeChangePatterns(req.code_changes);
    
    const historicalAnalysis = await analyzeHistoricalPatterns(
      req.project_id,
      req.environment_id
    );
    
    const timeBasedInsights = await analyzeTimeBasedRisks(
      req.project_id,
      req.environment_id
    );

    const allInsights = [
      ...codeInsights,
      ...historicalAnalysis.insights,
      ...timeBasedInsights,
    ];

    const riskFactors: RiskFactor[] = allInsights.map(insight => ({
      category: 'ai_analysis',
      severity: insight.severity,
      score: insight.severity === 'critical' ? 80 : 
             insight.severity === 'high' ? 60 :
             insight.severity === 'medium' ? 40 : 20,
      description: insight.insight,
      mitigation: insight.evidence[insight.evidence.length - 1],
    }));

    const overallRiskScore = riskFactors.reduce((sum, f) => sum + f.score, 0);
    const overallRiskLevel = 
      overallRiskScore < 30 ? 'low' :
      overallRiskScore < 60 ? 'medium' :
      overallRiskScore < 80 ? 'high' : 'critical';

    const avgConfidence = allInsights.length > 0
      ? allInsights.reduce((sum, i) => sum + i.confidence, 0) / allInsights.length
      : 0.5;

    const recommendations: string[] = [];
    
    if (historicalAnalysis.successRate < 80) {
      recommendations.push('Improve deployment process based on historical failure patterns');
    }
    
    if (allInsights.some(i => i.severity === 'critical')) {
      recommendations.push('Address critical risk factors before proceeding');
    }
    
    if (req.code_changes && req.code_changes.files_changed > 30) {
      recommendations.push('Consider breaking this deployment into smaller, incremental releases');
    }
    
    if (timeBasedInsights.some(i => i.insight.includes('Friday'))) {
      recommendations.push('Schedule deployment for earlier in the week if possible');
    }

    if (recommendations.length === 0) {
      recommendations.push('AI analysis shows low risk - deployment can proceed');
    }

    return {
      deployment_id: 0,
      overall_risk_score: overallRiskScore,
      overall_risk_level: overallRiskLevel,
      risk_factors: riskFactors,
      recommendations,
      should_proceed: overallRiskLevel !== 'critical' && historicalAnalysis.failureProbability < 30,
      assessed_at: new Date(),
      ai_insights: allInsights,
      predicted_failure_probability: historicalAnalysis.failureProbability,
      similar_deployments_success_rate: historicalAnalysis.successRate,
      confidence_score: avgConfidence,
    };
  }
);
