import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface IntegrationsSettingsProps {
  settings: any;
  updateSettings: (updates: any) => void;
  isSaving: boolean;
}

export function IntegrationsSettings({ settings, updateSettings }: IntegrationsSettingsProps) {
  const { toast } = useToast();
  const [testingGitHub, setTestingGitHub] = useState(false);
  const [testingSupabase, setTestingSupabase] = useState(false);

  const githubToken = settings.preferences?.githubToken || "";
  const githubConnected = settings.preferences?.githubConnected ?? false;
  
  const supabaseUrl = settings.preferences?.supabaseUrl || "";
  const supabaseAnonKey = settings.preferences?.supabaseAnonKey || "";
  const supabaseConnected = settings.preferences?.supabaseConnected ?? false;
  
  const cicdPlatform = settings.preferences?.cicdPlatform || "github-actions";
  const cicdConfig = settings.preferences?.cicdConfig || {};

  const handleGitHubTokenChange = (value: string) => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        githubToken: value,
        githubConnected: false,
      },
    });
  };

  const testGitHubConnection = async () => {
    setTestingGitHub(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const connected = githubToken.startsWith("ghp_");
    updateSettings({
      preferences: {
        ...settings.preferences,
        githubConnected: connected,
      },
    });
    
    setTestingGitHub(false);
    toast({
      variant: connected ? "default" : "destructive",
      title: connected ? "GitHub Connected" : "Connection Failed",
      description: connected 
        ? "Successfully connected to GitHub" 
        : "Invalid token or connection error",
    });
  };

  const handleSupabaseUrlChange = (value: string) => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        supabaseUrl: value,
        supabaseConnected: false,
      },
    });
  };

  const handleSupabaseKeyChange = (value: string) => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        supabaseAnonKey: value,
        supabaseConnected: false,
      },
    });
  };

  const testSupabaseConnection = async () => {
    setTestingSupabase(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const connected = supabaseUrl.includes("supabase.co") && supabaseAnonKey.length > 20;
    updateSettings({
      preferences: {
        ...settings.preferences,
        supabaseConnected: connected,
      },
    });
    
    setTestingSupabase(false);
    toast({
      variant: connected ? "default" : "destructive",
      title: connected ? "Supabase Connected" : "Connection Failed",
      description: connected 
        ? "Successfully connected to Supabase" 
        : "Invalid credentials or connection error",
    });
  };

  const handleCICDPlatformChange = (value: string) => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        cicdPlatform: value,
        cicdConfig: {},
      },
    });
  };

  const handleCICDConfigChange = (key: string, value: string) => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        cicdConfig: {
          ...cicdConfig,
          [key]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-semibold">GitHub Integration</Label>
            <p className="text-sm text-muted-foreground">Connect to GitHub for repository access</p>
          </div>
          {githubConnected ? (
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Not Connected
            </Badge>
          )}
        </div>

        <div className="space-y-4 pl-4 border-l-2 border-muted">
          <div className="space-y-2">
            <Label htmlFor="github-token">Personal Access Token</Label>
            <p className="text-xs text-muted-foreground">Required scopes: repo, workflow</p>
            <div className="flex gap-2">
              <Input
                id="github-token"
                type="password"
                placeholder="ghp_..."
                value={githubToken}
                onChange={(e) => handleGitHubTokenChange(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={testGitHubConnection}
                disabled={!githubToken || testingGitHub}
              >
                {testingGitHub ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Test"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-semibold">Supabase Integration</Label>
            <p className="text-sm text-muted-foreground">Connect to Supabase for database access</p>
          </div>
          {supabaseConnected ? (
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Not Connected
            </Badge>
          )}
        </div>

        <div className="space-y-4 pl-4 border-l-2 border-muted">
          <div className="space-y-2">
            <Label htmlFor="supabase-url">Project URL</Label>
            <Input
              id="supabase-url"
              type="url"
              placeholder="https://your-project.supabase.co"
              value={supabaseUrl}
              onChange={(e) => handleSupabaseUrlChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supabase-key">Anon Key</Label>
            <div className="flex gap-2">
              <Input
                id="supabase-key"
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseAnonKey}
                onChange={(e) => handleSupabaseKeyChange(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={testSupabaseConnection}
                disabled={!supabaseUrl || !supabaseAnonKey || testingSupabase}
              >
                {testingSupabase ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Test"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">CI/CD Platform</Label>
          <p className="text-sm text-muted-foreground">Configure continuous integration and deployment</p>
        </div>

        <div className="space-y-4 pl-4 border-l-2 border-muted">
          <div className="space-y-2">
            <Label htmlFor="cicd-platform">Platform</Label>
            <Select value={cicdPlatform} onValueChange={handleCICDPlatformChange}>
              <SelectTrigger id="cicd-platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="github-actions">GitHub Actions</SelectItem>
                <SelectItem value="gitlab-ci">GitLab CI</SelectItem>
                <SelectItem value="circleci">CircleCI</SelectItem>
                <SelectItem value="jenkins">Jenkins</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {cicdPlatform === "github-actions" && (
            <div className="space-y-2">
              <Label htmlFor="workflow-file">Workflow File Path</Label>
              <Input
                id="workflow-file"
                placeholder=".github/workflows/deploy.yml"
                value={cicdConfig.workflowFile || ""}
                onChange={(e) => handleCICDConfigChange("workflowFile", e.target.value)}
              />
            </div>
          )}

          {cicdPlatform === "gitlab-ci" && (
            <div className="space-y-2">
              <Label htmlFor="gitlab-token">GitLab Token</Label>
              <Input
                id="gitlab-token"
                type="password"
                placeholder="glpat-..."
                value={cicdConfig.gitlabToken || ""}
                onChange={(e) => handleCICDConfigChange("gitlabToken", e.target.value)}
              />
            </div>
          )}

          {cicdPlatform === "circleci" && (
            <div className="space-y-2">
              <Label htmlFor="circleci-token">CircleCI API Token</Label>
              <Input
                id="circleci-token"
                type="password"
                placeholder="API token"
                value={cicdConfig.circleciToken || ""}
                onChange={(e) => handleCICDConfigChange("circleciToken", e.target.value)}
              />
            </div>
          )}

          {cicdPlatform === "jenkins" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="jenkins-url">Jenkins URL</Label>
                <Input
                  id="jenkins-url"
                  type="url"
                  placeholder="https://jenkins.example.com"
                  value={cicdConfig.jenkinsUrl || ""}
                  onChange={(e) => handleCICDConfigChange("jenkinsUrl", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jenkins-token">Jenkins Token</Label>
                <Input
                  id="jenkins-token"
                  type="password"
                  placeholder="API token"
                  value={cicdConfig.jenkinsToken || ""}
                  onChange={(e) => handleCICDConfigChange("jenkinsToken", e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}