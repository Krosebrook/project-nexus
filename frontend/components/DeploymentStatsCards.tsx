import { Card, CardContent } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { getDeploymentStats, formatDuration } from "@/lib/deployment-data";
import type { Deployment } from "@/lib/deployment-data";

interface DeploymentStatsCardsProps {
  deployments: Deployment[];
}

export function DeploymentStatsCards({ deployments }: DeploymentStatsCardsProps) {
  const stats = getDeploymentStats(deployments);
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Deployments</p>
              <p className="text-3xl font-bold text-foreground mt-2">{stats.activeDeployments}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-yellow-500 animate-spin" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Success Rate (24h)</p>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-3xl font-bold text-foreground">{stats.successRate.toFixed(0)}%</p>
                {stats.successRate >= 90 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
              stats.successRate >= 90 ? "bg-green-500/10" : "bg-red-500/10"
            }`}>
              <span className={`text-2xl ${
                stats.successRate >= 90 ? "text-green-500" : "text-red-500"
              }`}>✓</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Deploy Time</p>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-3xl font-bold text-foreground">{formatDuration(Math.round(stats.avgDeployTime))}</p>
                {stats.avgDeployTime < 300 ? (
                  <TrendingDown className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-yellow-500" />
                )}
              </div>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Queued</p>
              <p className="text-3xl font-bold text-foreground mt-2">{stats.queuedDeployments}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-gray-500/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-gray-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}