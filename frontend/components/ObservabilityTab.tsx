import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, AlertTriangle } from "lucide-react";
import backend from "~backend/client";
import type { Project } from "~backend/projects/types";
import type { AlertRule } from "~backend/alerts/types";
import { formatDistanceToNow } from "date-fns";

interface ObservabilityTabProps {
  project: Project;
}

export function ObservabilityTab({ project }: ObservabilityTabProps) {
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, [project.id]);

  const loadAlerts = async () => {
    try {
      const { alerts } = await backend.alerts.list({ project_id: project.id });
      setAlerts(alerts);
    } catch (error) {
      console.error("Failed to load alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAlert = async (alert: AlertRule) => {
    try {
      await backend.alerts.toggle({ id: alert.id, enabled: !alert.enabled });
      await loadAlerts();
    } catch (error) {
      console.error("Failed to toggle alert:", error);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading alerts...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Alert Rules</h2>
          <p className="text-muted-foreground">Monitor and manage system alerts</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {alerts.map((alert) => (
          <Card key={alert.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {alert.enabled ? (
                      <Bell className="h-4 w-4 text-blue-500" />
                    ) : (
                      <BellOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <CardTitle className="text-lg">{alert.name}</CardTitle>
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    {alert.last_triggered && (
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Triggered {formatDistanceToNow(new Date(alert.last_triggered), { addSuffix: true })}
                      </span>
                    )}
                  </CardDescription>
                </div>
                <Switch
                  checked={alert.enabled}
                  onCheckedChange={() => toggleAlert(alert)}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Condition</span>
                  <span className="font-mono">{alert.condition}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Threshold</span>
                  <Badge variant="outline">{alert.threshold}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Channel</span>
                  <span className="font-mono text-xs">{alert.notification_channel}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
