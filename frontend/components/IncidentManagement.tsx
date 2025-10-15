import { useEffect, useState } from "react";
import backend from "~backend/client";
import type { Incident, IncidentSeverity, IncidentStatus } from "~backend/deployments/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle, Clock, Search } from "lucide-react";

interface IncidentManagementProps {
  projectId: number;
}

export function IncidentManagement({ projectId }: IncidentManagementProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<{ open: number; investigating: number; resolved: number; closed: number }>({ open: 0, investigating: 0, resolved: 0, closed: 0 });
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIncidents();
    loadStats();
  }, [projectId, filterStatus]);

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const res = await backend.deployments.listIncidents({
        projectId,
        status: filterStatus === "all" ? undefined : filterStatus
      });
      setIncidents(res.incidents);
    } catch (error) {
      console.error("Failed to load incidents:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await backend.deployments.getIncidentStats({ projectId });
      setStats(data);
    } catch (error) {
      console.error("Failed to load incident stats:", error);
    }
  };

  const updateIncidentStatus = async (id: number, status: IncidentStatus) => {
    try {
      await backend.deployments.updateIncident({ id, status });
      loadIncidents();
      loadStats();
    } catch (error) {
      console.error("Failed to update incident:", error);
    }
  };

  const getSeverityColor = (severity: IncidentSeverity): string => {
    const colors = {
      low: "bg-blue-500",
      medium: "bg-yellow-500",
      high: "bg-orange-500",
      critical: "bg-red-500"
    };
    return colors[severity];
  };

  const getStatusIcon = (status: IncidentStatus) => {
    switch (status) {
      case "open":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "investigating":
        return <Search className="w-4 h-4 text-yellow-500" />;
      case "resolved":
      case "closed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Incident Management</h3>
          <Select
            value={filterStatus}
            onValueChange={(value) => setFilterStatus(value as IncidentStatus | "all")}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{stats.open || 0}</div>
            <div className="text-sm text-muted-foreground">Open</div>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{stats.investigating || 0}</div>
            <div className="text-sm text-muted-foreground">Investigating</div>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{stats.resolved || 0}</div>
            <div className="text-sm text-muted-foreground">Resolved</div>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{stats.closed || 0}</div>
            <div className="text-sm text-muted-foreground">Closed</div>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading incidents...
          </div>
        ) : incidents.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No incidents found
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((incident) => (
              <div
                key={incident.id}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(incident.status)}
                      <div className={`w-2 h-2 rounded-full ${getSeverityColor(incident.severity)}`} />
                      <h4 className="font-semibold">{incident.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {incident.severity}
                      </Badge>
                    </div>
                    
                    {incident.description && (
                      <p className="text-sm text-muted-foreground">
                        {incident.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Created {new Date(incident.created_at).toLocaleString()}</span>
                      {incident.resolved_at && (
                        <span>Resolved {new Date(incident.resolved_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {incident.status === "open" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateIncidentStatus(incident.id, "investigating")}
                      >
                        Investigate
                      </Button>
                    )}
                    {incident.status === "investigating" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateIncidentStatus(incident.id, "resolved")}
                      >
                        Resolve
                      </Button>
                    )}
                    {incident.status === "resolved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateIncidentStatus(incident.id, "closed")}
                      >
                        Close
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}