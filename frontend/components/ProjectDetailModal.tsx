import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import type { Project } from "~backend/projects/types";
import { formatRelativeTime, type MetricDataPoint } from "@/lib/metrics-utils";
import { useCountUp } from "@/hooks/useCountUp";
import { 
  Rocket, 
  FileText, 
  RotateCw, 
  Settings, 
  TrendingUp, 
  Activity, 
  AlertCircle,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectDetailModalProps {
  project: Project | null;
  latencyData: MetricDataPoint[];
  errorRateData: MetricDataPoint[];
  uptimeData: MetricDataPoint[];
  onClose: () => void;
}

interface DeploymentRecord {
  id: string;
  version: string;
  timestamp: Date;
  status: "success" | "failed" | "pending";
  duration: string;
}

export function ProjectDetailModal({
  project,
  latencyData,
  errorRateData,
  uptimeData,
  onClose
}: ProjectDetailModalProps) {
  if (!project) return null;
  
  const latency = project.metrics.avg_response_time || 0;
  const errorRate = project.metrics.error_rate || 0;
  const uptime = project.metrics.uptime_pct || 0;
  
  const animatedLatency = useCountUp(latency, 400);
  const animatedErrorRate = useCountUp(errorRate, 400);
  const animatedUptime = useCountUp(uptime, 400);
  
  const sevenDayData = latencyData.slice(-168);
  const latencyChartData = sevenDayData.map(d => ({
    time: new Date(d.timestamp).toLocaleDateString(),
    latency: d.value
  }));
  
  const errorChartData = errorRateData.slice(-168).map(d => ({
    time: new Date(d.timestamp).toLocaleDateString(),
    errors: d.value
  }));
  
  const uptimeChartData = uptimeData.slice(-168).map(d => ({
    time: new Date(d.timestamp).toLocaleDateString(),
    uptime: d.value
  }));
  
  const mockDeployments: DeploymentRecord[] = [
    { id: "1", version: "v1.2.4", timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), status: "success", duration: "2m 34s" },
    { id: "2", version: "v1.2.3", timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), status: "success", duration: "2m 12s" },
    { id: "3", version: "v1.2.2", timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), status: "success", duration: "2m 45s" },
    { id: "4", version: "v1.2.1", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), status: "failed", duration: "1m 23s" },
    { id: "5", version: "v1.2.0", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), status: "success", duration: "3m 01s" },
  ];
  
  const activeAlerts = [
    errorRate > 1 && { severity: "warning", message: "Error rate above threshold (1%)" },
    latency > 300 && { severity: "warning", message: "High latency detected (>300ms)" },
    uptime < 99 && { severity: "critical", message: "Uptime below 99%" },
  ].filter(Boolean) as Array<{ severity: string; message: string }>;
  
  return (
    <Dialog open={!!project} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">{project.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
            </div>
            <Badge variant="outline" className="capitalize">
              {project.status}
            </Badge>
          </div>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Activity className="h-4 w-4" />
                <span className="text-sm">Avg Latency</span>
              </div>
              <div className="text-2xl font-bold">{animatedLatency.toFixed(0)}ms</div>
              <div className="text-xs text-muted-foreground mt-1">Last 24 hours</div>
            </div>
            
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Error Rate</span>
              </div>
              <div className={cn(
                "text-2xl font-bold",
                errorRate > 1 && "text-red-500"
              )}>
                {animatedErrorRate.toFixed(2)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Last 24 hours</div>
            </div>
            
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Uptime</span>
              </div>
              <div className="text-2xl font-bold">{animatedUptime.toFixed(2)}%</div>
              <div className="text-xs text-muted-foreground mt-1">Last 24 hours</div>
            </div>
          </div>
          
          {activeAlerts.length > 0 && (
            <div className="p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                Active Alerts
              </h3>
              <div className="space-y-1.5">
                {activeAlerts.map((alert, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      alert.severity === "critical" ? "bg-red-500 animate-pulse" : "bg-yellow-500"
                    )} />
                    <span>{alert.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div>
            <h3 className="font-semibold mb-3">Latency Trend (7 Days)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={latencyChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="time" 
                  className="text-xs"
                  tick={{ fontSize: 10 }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fontSize: 10 }}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="latency"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-3">Error Rate (7 Days)</h3>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={errorChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="errors"
                    stroke="hsl(0 72% 51%)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3">Uptime (7 Days)</h3>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={uptimeChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                    domain={[95, 100]}
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="uptime"
                    stroke="hsl(142 76% 36%)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Deployments
            </h3>
            <div className="space-y-2">
              {mockDeployments.map((deployment) => (
                <div
                  key={deployment.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={deployment.status === "success" ? "default" : deployment.status === "failed" ? "destructive" : "secondary"}
                      className="w-20 justify-center"
                    >
                      {deployment.status}
                    </Badge>
                    <div>
                      <div className="font-medium text-sm">{deployment.version}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatRelativeTime(deployment.timestamp)} • {deployment.duration}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="font-semibold mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="default" className="w-full">
                <Rocket className="h-4 w-4 mr-2" />
                Deploy
              </Button>
              <Button variant="outline" className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                View Logs
              </Button>
              <Button variant="outline" className="w-full">
                <RotateCw className="h-4 w-4 mr-2" />
                Restart
              </Button>
              <Button variant="outline" className="w-full">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}