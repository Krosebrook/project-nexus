import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { AlertCircle, AlertTriangle, CheckCircle, XCircle, Lightbulb } from 'lucide-react';
import backend from '~backend/client';
import { Skeleton } from './ui/skeleton';

interface RiskFactor {
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  weight: number;
}

interface AIRiskSuggestion {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

interface DeploymentRiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
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

interface DeploymentRiskCardProps {
  projectId: number;
  environment: string;
  filesChanged?: number;
  scheduledTime?: Date;
  commitHash?: string;
}

export function DeploymentRiskCard({
  projectId,
  environment,
  filesChanged,
  scheduledTime,
  commitHash
}: DeploymentRiskCardProps) {
  const [assessment, setAssessment] = useState<DeploymentRiskAssessment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRiskAssessment();
  }, [projectId, environment, filesChanged, scheduledTime]);

  const loadRiskAssessment = async () => {
    setLoading(true);
    try {
      const response = await backend.deployments.assessRisk({
        projectId,
        environment,
        filesChanged,
        scheduledTime,
        commitHash
      });
      setAssessment(response.assessment);
    } catch (error) {
      console.error('Failed to load risk assessment:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'low':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'medium':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getRiskColor = (risk: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (risk) {
      case 'low':
        return 'secondary';
      case 'medium':
        return 'outline';
      case 'high':
        return 'default';
      case 'critical':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getRiskBgColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'bg-green-500/10 border-green-500/20';
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/20';
      case 'high':
        return 'bg-orange-500/10 border-orange-500/20';
      case 'critical':
        return 'bg-red-500/10 border-red-500/20';
      default:
        return 'bg-muted';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Lightbulb className="h-4 w-4 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!assessment) {
    return null;
  }

  return (
    <Card className={`border-2 ${getRiskBgColor(assessment.overallRisk)}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getRiskIcon(assessment.overallRisk)}
            <CardTitle>Deployment Risk Assessment</CardTitle>
          </div>
          <Badge variant={getRiskColor(assessment.overallRisk)} className="capitalize">
            {assessment.overallRisk} Risk
          </Badge>
        </div>
        <CardDescription>
          Risk Score: {assessment.riskScore}/100
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {assessment.factors.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 text-sm">Risk Factors</h4>
            <div className="space-y-2">
              {assessment.factors.map((factor, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-2 bg-background rounded-lg border"
                >
                  {getRiskIcon(factor.severity)}
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">
                      {factor.category.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">{factor.description}</p>
                  </div>
                  <Badge variant={getRiskColor(factor.severity)} className="text-xs">
                    {factor.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {assessment.suggestions.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              AI Suggestions
            </h4>
            <div className="space-y-2">
              {assessment.suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-3 bg-background rounded-lg border"
                >
                  {getPriorityIcon(suggestion.priority)}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{suggestion.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {suggestion.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-3 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Files Changed</p>
            <p className="text-lg font-semibold">{assessment.metadata.filesChanged}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Recent Failures</p>
            <p className="text-lg font-semibold">{assessment.metadata.recentFailures}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Traffic Level</p>
            <p className="text-lg font-semibold capitalize">{assessment.metadata.trafficLevel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Breaking Changes</p>
            <p className="text-lg font-semibold">
              {assessment.metadata.isBreakingChange ? 'Yes' : 'No'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
