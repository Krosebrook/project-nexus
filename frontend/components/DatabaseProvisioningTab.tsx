import { useState, useEffect } from "react";
import backend from "~backend/client";
import type { ProvisionedDatabase } from "~backend/provisioning/types";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Database, RefreshCw, Trash2, Eye, Copy, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "./ui/use-toast";

export function DatabaseProvisioningTab() {
  const [databases, setDatabases] = useState<ProvisionedDatabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProvisionForm, setShowProvisionForm] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    projectId: "",
    provider: "neon" as const,
    region: "aws-us-east-2",
    name: "",
  });

  useEffect(() => {
    loadDatabases();
    loadProjects();
  }, []);

  const loadDatabases = async () => {
    try {
      const response = await backend.provisioning.list({});
      setDatabases(response.databases);
    } catch (error: any) {
      toast({
        title: "Error loading databases",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const response = await backend.projects.list();
      setProjects(response.projects.map(p => ({ id: String(p.id), name: p.name })));
    } catch (error: any) {
      console.error("Error loading projects:", error);
    }
  };

  const handleProvision = async () => {
    try {
      setLoading(true);
      await backend.provisioning.provision(formData);
      toast({
        title: "Database provisioning started",
        description: "Your database is being provisioned. This may take a few minutes.",
      });
      setShowProvisionForm(false);
      setFormData({ projectId: "", provider: "neon", region: "aws-us-east-2", name: "" });
      setTimeout(loadDatabases, 2000);
    } catch (error: any) {
      toast({
        title: "Provisioning failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this database? This action cannot be undone.")) {
      return;
    }

    try {
      await backend.provisioning.deleteDatabase({ id });
      toast({
        title: "Database deletion started",
        description: "The database is being deleted.",
      });
      setTimeout(loadDatabases, 2000);
    } catch (error: any) {
      toast({
        title: "Deletion failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewConnection = async (id: string) => {
    try {
      const info = await backend.provisioning.getConnectionInfo({ id });
      const details = `Host: ${info.host}\nPort: ${info.port}\nDatabase: ${info.database}\nUsername: ${info.username}\nPassword: ${info.password}\n\nConnection String:\n${info.connectionString}`;
      
      navigator.clipboard.writeText(info.connectionString);
      toast({
        title: "Connection info copied",
        description: "Connection string copied to clipboard",
      });

      alert(details);
    } catch (error: any) {
      toast({
        title: "Error fetching connection info",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "provisioning":
      case "deleting":
        return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      failed: "destructive",
      provisioning: "secondary",
      deleting: "outline",
    };

    return (
      <Badge variant={variants[status] || "outline"} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };

  if (loading && databases.length === 0) {
    return <div className="flex items-center justify-center h-64">Loading databases...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Database Provisioning</h2>
          <p className="text-muted-foreground">Manage Neon PostgreSQL databases with GCP integration</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadDatabases} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowProvisionForm(!showProvisionForm)}>
            <Database className="w-4 h-4 mr-2" />
            Provision New Database
          </Button>
        </div>
      </div>

      {showProvisionForm && (
        <Card>
          <CardHeader>
            <CardTitle>Provision New Database</CardTitle>
            <CardDescription>Create a new Neon PostgreSQL database with GCP IAM integration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="project">Project</Label>
              <Select value={formData.projectId} onValueChange={(value) => setFormData({ ...formData, projectId: value })}>
                <SelectTrigger id="project">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="name">Database Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="my-database"
              />
            </div>

            <div>
              <Label htmlFor="region">Region</Label>
              <Select value={formData.region} onValueChange={(value) => setFormData({ ...formData, region: value })}>
                <SelectTrigger id="region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aws-us-east-2">US East (Ohio)</SelectItem>
                  <SelectItem value="aws-us-east-1">US East (N. Virginia)</SelectItem>
                  <SelectItem value="aws-us-west-2">US West (Oregon)</SelectItem>
                  <SelectItem value="aws-eu-central-1">EU (Frankfurt)</SelectItem>
                  <SelectItem value="aws-ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowProvisionForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleProvision} disabled={!formData.projectId || loading}>
                Provision Database
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {databases.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Database className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No databases provisioned yet</p>
              <Button className="mt-4" onClick={() => setShowProvisionForm(true)}>
                Provision Your First Database
              </Button>
            </CardContent>
          </Card>
        )}

        {databases.map((db) => (
          <Card key={db.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5" />
                  <div>
                    <CardTitle className="text-lg">{db.name}</CardTitle>
                    <CardDescription>
                      {db.provider} • {db.region}
                    </CardDescription>
                  </div>
                </div>
                {getStatusBadge(db.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Host:</span> {db.host || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Port:</span> {db.port || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Database:</span> {db.database || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Username:</span> {db.username || "—"}
                </div>
                {db.gcpServiceAccount && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">GCP Service Account:</span> {db.gcpServiceAccount}
                  </div>
                )}
                {db.errorMessage && (
                  <div className="col-span-2 text-destructive">
                    <span className="font-semibold">Error:</span> {db.errorMessage}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {db.status === "active" && (
                  <Button variant="outline" size="sm" onClick={() => handleViewConnection(db.id)}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Connection
                  </Button>
                )}
                {(db.status === "active" || db.status === "failed") && (
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(db.id)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
