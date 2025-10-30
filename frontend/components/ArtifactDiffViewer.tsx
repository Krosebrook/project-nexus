import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { FileCode, Plus, Minus, FileX, GitCommit, Calendar, Download, Copy } from 'lucide-react';
import backend from '~backend/client';
import { useToast } from './ui/use-toast';
import { Skeleton } from './ui/skeleton';

interface DeploymentDiff {
  id: number;
  deploymentAId: number;
  deploymentBId: number;
  diffType: string;
  summary: {
    total_artifacts_a: number;
    total_artifacts_b: number;
    files_changed: number;
    added: number;
    removed: number;
    modified: number;
  };
  details: {
    changes: Array<{
      artifact_name: string;
      change_type: 'added' | 'removed' | 'modified';
      version_a?: string;
      version_b?: string;
      hash_changed?: boolean;
    }>;
  };
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
}

interface ArtifactVersion {
  id: number;
  projectId: number;
  artifactName: string;
  version: string;
  previousVersion: string | null;
  commitHash: string | null;
  buildNumber: string | null;
  changelog: string | null;
  isLatest: boolean;
  metadata: Record<string, any>;
  createdBy: string | null;
  createdAt: Date;
}

interface ArtifactDiffViewerProps {
  projectId: number;
  deploymentAId: number;
  deploymentBId: number;
}

export function ArtifactDiffViewer({ projectId, deploymentAId, deploymentBId }: ArtifactDiffViewerProps) {
  const [diff, setDiff] = useState<DeploymentDiff | null>(null);
  const [versionsA, setVersionsA] = useState<ArtifactVersion[]>([]);
  const [versionsB, setVersionsB] = useState<ArtifactVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDiff();
  }, [deploymentAId, deploymentBId]);

  const loadDiff = async () => {
    setLoading(true);
    try {
      const diffResponse = await backend.deployments.compareDeployments({
        deployment_a_id: deploymentAId,
        deployment_b_id: deploymentBId
      });

      setDiff({
        id: diffResponse.id,
        deploymentAId: diffResponse.deployment_a_id,
        deploymentBId: diffResponse.deployment_b_id,
        diffType: diffResponse.diff_type,
        summary: JSON.parse(typeof diffResponse.summary === 'string' ? diffResponse.summary : JSON.stringify(diffResponse.summary)),
        details: JSON.parse(typeof diffResponse.details === 'string' ? diffResponse.details : JSON.stringify(diffResponse.details)),
        filesChanged: diffResponse.files_changed,
        linesAdded: diffResponse.lines_added || 0,
        linesRemoved: diffResponse.lines_removed || 0
      });

    } catch (error) {
      console.error('Failed to load diff:', error);
      toast({
        title: 'Error',
        description: 'Failed to load deployment comparison',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyComparisonLink = () => {
    const url = `${window.location.origin}/deployments/compare?a=${deploymentAId}&b=${deploymentBId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Copied',
      description: 'Comparison link copied to clipboard'
    });
  };

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'removed':
        return <Minus className="h-4 w-4 text-red-500" />;
      case 'modified':
        return <FileCode className="h-4 w-4 text-yellow-500" />;
      default:
        return <FileX className="h-4 w-4" />;
    }
  };

  const getChangeBadgeVariant = (changeType: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (changeType) {
      case 'added':
        return 'secondary';
      case 'removed':
        return 'destructive';
      case 'modified':
        return 'outline';
      default:
        return 'outline';
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
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!diff) {
    return null;
  }

  const addedChanges = diff.details.changes.filter(c => c.change_type === 'added');
  const removedChanges = diff.details.changes.filter(c => c.change_type === 'removed');
  const modifiedChanges = diff.details.changes.filter(c => c.change_type === 'modified');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Deployment Comparison</CardTitle>
            <CardDescription>
              Comparing deployment #{deploymentAId} with #{deploymentBId}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyComparisonLink}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Link
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{diff.summary.files_changed}</p>
                <p className="text-sm text-muted-foreground">Files Changed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{diff.summary.added}</p>
                <p className="text-sm text-muted-foreground">Added</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-500/10">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-600">{diff.summary.modified}</p>
                <p className="text-sm text-muted-foreground">Modified</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-500/10">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-red-600">{diff.summary.removed}</p>
                <p className="text-sm text-muted-foreground">Removed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All Changes ({diff.details.changes.length})</TabsTrigger>
            <TabsTrigger value="added">Added ({addedChanges.length})</TabsTrigger>
            <TabsTrigger value="modified">Modified ({modifiedChanges.length})</TabsTrigger>
            <TabsTrigger value="removed">Removed ({removedChanges.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-2 mt-4">
            {diff.details.changes.map((change, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getChangeIcon(change.change_type)}
                  <div>
                    <p className="font-medium font-mono text-sm">{change.artifact_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {change.version_a && (
                        <span className="text-xs text-muted-foreground">v{change.version_a}</span>
                      )}
                      {change.version_a && change.version_b && (
                        <span className="text-xs text-muted-foreground">→</span>
                      )}
                      {change.version_b && (
                        <span className="text-xs text-muted-foreground">v{change.version_b}</span>
                      )}
                    </div>
                  </div>
                </div>
                <Badge variant={getChangeBadgeVariant(change.change_type)} className="capitalize">
                  {change.change_type}
                </Badge>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="added" className="space-y-2 mt-4">
            {addedChanges.map((change, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border border-green-500/20 bg-green-500/5 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Plus className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="font-medium font-mono text-sm">{change.artifact_name}</p>
                    <span className="text-xs text-muted-foreground">v{change.version_b}</span>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="modified" className="space-y-2 mt-4">
            {modifiedChanges.map((change, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border border-yellow-500/20 bg-yellow-500/5 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileCode className="h-4 w-4 text-yellow-500" />
                  <div>
                    <p className="font-medium font-mono text-sm">{change.artifact_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">v{change.version_a}</span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="text-xs text-muted-foreground">v{change.version_b}</span>
                    </div>
                  </div>
                </div>
                {change.hash_changed && (
                  <Badge variant="outline" className="text-xs">
                    Hash Changed
                  </Badge>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="removed" className="space-y-2 mt-4">
            {removedChanges.map((change, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border border-red-500/20 bg-red-500/5 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Minus className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="font-medium font-mono text-sm">{change.artifact_name}</p>
                    <span className="text-xs text-muted-foreground">v{change.version_a}</span>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
