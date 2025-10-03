import { api } from "encore.dev/api";
import db from "../db";

export interface RiskFactor {
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  description: string;
  mitigation?: string;
}

export interface DeploymentRiskAssessment {
  deployment_id: number;
  overall_risk_score: number;
  overall_risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: RiskFactor[];
  recommendations: string[];
  should_proceed: boolean;
  assessed_at: Date;
}

export interface AssessDeploymentRiskRequest {
  project_id: number;
  environment_id: number;
  deployment_metadata?: Record<string, any>;
}

function calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score < 30) return 'low';
  if (score < 60) return 'medium';
  if (score < 80) return 'high';
  return 'critical';
}

export const assessDeploymentRisk = api(
  { method: "POST", path: "/deployments/risk-assessment", expose: true },
  async (req: AssessDeploymentRiskRequest): Promise<DeploymentRiskAssessment> => {
    const riskFactors: RiskFactor[] = [];

    const recentFailures = await db.queryAll<{ id: number; error_message: string | null }>`
      SELECT id, error_message
      FROM deployment_logs
      WHERE project_id = ${req.project_id}
        AND environment_id = ${req.environment_id}
        AND status = 'failed'
        AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 5
    `;

    if (recentFailures.length > 0) {
      const failureScore = Math.min(recentFailures.length * 15, 50);
      riskFactors.push({
        category: 'recent_failures',
        severity: recentFailures.length > 2 ? 'high' : 'medium',
        score: failureScore,
        description: `${recentFailures.length} failed deployment(s) in the last 7 days`,
        mitigation: 'Review recent failure logs and ensure issues are resolved before deploying',
      });
    }

    const activeIncidents = await db.queryAll<{ id: number; severity: string }>`
      SELECT id, severity
      FROM incidents
      WHERE project_id = ${req.project_id}
        AND status IN ('open', 'investigating')
        AND severity IN ('high', 'critical')
      LIMIT 10
    `;

    if (activeIncidents.length > 0) {
      const incidentScore = activeIncidents.length * 20;
      const hasCritical = activeIncidents.some(i => i.severity === 'critical');
      riskFactors.push({
        category: 'active_incidents',
        severity: hasCritical ? 'critical' : 'high',
        score: incidentScore,
        description: `${activeIncidents.length} active high/critical incident(s)`,
        mitigation: 'Resolve active incidents before deploying to avoid compounding issues',
      });
    }

    const recentDeployments = await db.queryAll<{ id: number }>`
      SELECT id
      FROM deployment_logs
      WHERE project_id = ${req.project_id}
        AND environment_id = ${req.environment_id}
        AND status = 'success'
        AND created_at > NOW() - INTERVAL '1 hour'
      LIMIT 1
    `;

    if (recentDeployments.length > 0) {
      riskFactors.push({
        category: 'deployment_frequency',
        severity: 'medium',
        score: 25,
        description: 'Recent deployment detected within the last hour',
        mitigation: 'Consider waiting to observe the stability of the recent deployment',
      });
    }

    const testCoverage = await db.queryRow<{ coverage_percentage: number | null }>`
      SELECT coverage_percentage
      FROM test_coverage
      WHERE project_id = ${req.project_id}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (testCoverage && testCoverage.coverage_percentage !== null) {
      if (testCoverage.coverage_percentage < 50) {
        riskFactors.push({
          category: 'test_coverage',
          severity: 'high',
          score: 40,
          description: `Low test coverage: ${testCoverage.coverage_percentage.toFixed(1)}%`,
          mitigation: 'Increase test coverage to at least 70% before deploying to production',
        });
      } else if (testCoverage.coverage_percentage < 70) {
        riskFactors.push({
          category: 'test_coverage',
          severity: 'medium',
          score: 20,
          description: `Moderate test coverage: ${testCoverage.coverage_percentage.toFixed(1)}%`,
          mitigation: 'Consider increasing test coverage for better confidence',
        });
      }
    } else {
      riskFactors.push({
        category: 'test_coverage',
        severity: 'critical',
        score: 60,
        description: 'No test coverage data available',
        mitigation: 'Run tests and ensure coverage metrics are available before deploying',
      });
    }

    const failedTests = await db.queryAll<{ id: number }>`
      SELECT id
      FROM test_cases
      WHERE project_id = ${req.project_id}
        AND status = 'failed'
        AND last_run > NOW() - INTERVAL '24 hours'
    `;

    if (failedTests.length > 0) {
      riskFactors.push({
        category: 'test_failures',
        severity: 'critical',
        score: 70,
        description: `${failedTests.length} test(s) failing in the last 24 hours`,
        mitigation: 'Fix all failing tests before proceeding with deployment',
      });
    }

    const environment = await db.queryRow<{ type: string }>`
      SELECT type FROM environments WHERE id = ${req.environment_id}
    `;

    if (environment?.type === 'production') {
      const hasApproval = await db.queryRow<{ id: number }>`
        SELECT id FROM approval_rules
        WHERE project_id = ${req.project_id}
          AND environment = 'production'
          AND is_active = true
        LIMIT 1
      `;

      if (!hasApproval) {
        riskFactors.push({
          category: 'approval_policy',
          severity: 'medium',
          score: 15,
          description: 'No approval policy configured for production',
          mitigation: 'Consider setting up approval requirements for production deployments',
        });
      }
    }

    const overallRiskScore = riskFactors.reduce((sum, factor) => sum + factor.score, 0);
    const overallRiskLevel = calculateRiskLevel(overallRiskScore);

    const recommendations: string[] = [];
    
    if (failedTests.length > 0) {
      recommendations.push('Fix all failing tests before deployment');
    }
    
    if (activeIncidents.length > 0) {
      recommendations.push('Resolve active incidents before deploying');
    }
    
    if (recentFailures.length > 2) {
      recommendations.push('Investigate and address the root cause of recent deployment failures');
    }
    
    if (testCoverage && testCoverage.coverage_percentage !== null && testCoverage.coverage_percentage < 70) {
      recommendations.push('Improve test coverage to reduce deployment risk');
    }
    
    if (environment?.type === 'production' && overallRiskScore > 60) {
      recommendations.push('Consider deploying to staging environment first to validate changes');
    }

    if (recommendations.length === 0) {
      recommendations.push('All checks passed - deployment can proceed with confidence');
    }

    return {
      deployment_id: 0,
      overall_risk_score: overallRiskScore,
      overall_risk_level: overallRiskLevel,
      risk_factors: riskFactors,
      recommendations,
      should_proceed: overallRiskLevel !== 'critical' && failedTests.length === 0,
      assessed_at: new Date(),
    };
  }
);