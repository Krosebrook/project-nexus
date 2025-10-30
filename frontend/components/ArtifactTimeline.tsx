import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { GitCommit, Clock, Download, RotateCcw, GitBranch } from 'lucide-react';
import backend from '~backend/client';
import { useToast } from './ui/use-toast';
import { Skeleton } from './ui/skeleton';

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

interface ArtifactTimelineProps {
  projectId: number;
  artifactName?: string;
  onCompare?: (versionA: ArtifactVersion, versionB: ArtifactVersion) => void;
  onRollback?: (version: ArtifactVersion) => void;
}

export function ArtifactTimeline({ projectId, artifactName, onCompare, onRollback }: ArtifactTimelineProps) {
  const [versions, setVersions] = useState<ArtifactVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersions, setSelectedVersions] = useState<ArtifactVersion[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadVersions();
  }, [projectId, artifactName]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const response = await backend.deployments.listVersions({
        project_id: projectId,
        artifact_name: artifactName,
        limit: 50
      });

      setVersions(response.versions.map((v: any) => ({
        ...v,
        createdAt: new Date(v.created_at)
      })));
    } catch (error) {
      console.error('Failed to load versions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load artifact versions',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleVersionSelection = (version: ArtifactVersion) => {
    setSelectedVersions(prev => {
      const exists = prev.find(v => v.id === version.id);
      if (exists) {
        return prev.filter(v => v.id !== version.id);
      }
      if (prev.length >= 2) {
        return [prev[1], version];
      }
      return [...prev, version];
    });
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2 && onCompare) {
      onCompare(selectedVersions[0], selectedVersions[1]);
    }
  };

  const handleRollback = (version: ArtifactVersion) => {
    if (onRollback) {
      onRollback(version);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(date);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Version History
            </CardTitle>
            <CardDescription>
              {artifactName ? `${artifactName} versions` : 'All artifact versions'}
            </CardDescription>
          </div>
          {selectedVersions.length === 2 && (
            <Button onClick={handleCompare} size="sm">
              Compare Selected
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <div className="text-center py-8">
            <GitCommit className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">No versions found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {versions.map((version, index) => {
              const isSelected = selectedVersions.some(v => v.id === version.id);
              
              return (
                <div
                  key={version.id}
                  className={`
                    relative p-4 border rounded-lg transition-all cursor-pointer
                    ${isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}
                  `}
                  onClick={() => toggleVersionSelection(version)}
                >
                  {index < versions.length - 1 && (
                    <div className="absolute left-6 top-14 bottom-[-8px] w-0.5 bg-border" />
                  )}
                  
                  <div className="flex items-start gap-4">
                    <div className="relative flex-shrink-0 mt-1">
                      <div className={`
                        w-3 h-3 rounded-full border-2
                        ${version.isLatest ? 'bg-green-500 border-green-500' : 'bg-background border-border'}
                      `} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-semibold font-mono text-sm">v{version.version}</p>
                        {version.isLatest && (
                          <Badge variant="secondary" className="text-xs">Latest</Badge>
                        )}
                        {isSelected && (
                          <Badge variant="default" className="text-xs">Selected</Badge>
                        )}
                      </div>

                      {version.changelog && (
                        <p className="text-sm text-muted-foreground mb-2">{version.changelog}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatRelativeTime(version.createdAt)}</span>
                        </div>
                        
                        {version.commitHash && (
                          <div className="flex items-center gap-1">
                            <GitCommit className="h-3 w-3" />
                            <code className="font-mono">{version.commitHash.substring(0, 7)}</code>
                          </div>
                        )}

                        {version.buildNumber && (
                          <div className="flex items-center gap-1">
                            <span>Build #{version.buildNumber}</span>
                          </div>
                        )}

                        {version.createdBy && (
                          <div className="flex items-center gap-1">
                            <span>by {version.createdBy}</span>
                          </div>
                        )}
                      </div>

                      {version.metadata && Object.keys(version.metadata).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Object.entries(version.metadata).slice(0, 3).map(([key, value]) => (
                            <Badge key={key} variant="outline" className="text-xs">
                              {key}: {String(value)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-2">
                      {!version.isLatest && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRollback(version);
                          }}
                          title="Rollback to this version"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toast({
                            title: 'Download',
                            description: 'Download functionality coming soon'
                          });
                        }}
                        title="Download artifact"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
