import { useState, useEffect } from 'react';
import { X, Plus, Trash2, RotateCcw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import backend from '~backend/client';
import type { ContextSnapshot } from '~backend/snapshots/types';
import type { Project } from '~backend/projects/types';

interface ContextSnapshotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: Project | null;
  onRestore: (snapshot: ContextSnapshot) => void;
}

export function ContextSnapshotPanel({ isOpen, onClose, currentProject, onRestore }: ContextSnapshotPanelProps) {
  const [snapshots, setSnapshots] = useState<ContextSnapshot[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [urls, setUrls] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSnapshots();
    }
  }, [isOpen]);

  const loadSnapshots = async () => {
    try {
      const result = await backend.snapshots.list();
      setSnapshots(result.snapshots);
    } catch (error) {
      console.error('Failed to load snapshots:', error);
    }
  };

  const handleSave = async () => {
    if (!currentProject || !notes.trim()) return;

    setLoading(true);
    try {
      await backend.snapshots.save({
        project_id: currentProject.id,
        notes: notes.trim(),
        urls: urls.filter(u => u.trim())
      });
      setNotes('');
      setUrls(['']);
      setIsFormOpen(false);
      await loadSnapshots();
    } catch (error) {
      console.error('Failed to save snapshot:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this context snapshot?')) return;
    try {
      await backend.snapshots.del({ id });
      await loadSnapshots();
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
    }
  };

  const formatRelativeTime = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  const addUrlField = () => setUrls([...urls, '']);
  const updateUrl = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[450px] h-full bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Context Snapshots</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isFormOpen ? (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div>
                <label className="text-sm font-medium mb-2 block">Project</label>
                <Input value={currentProject?.name || 'No project selected'} disabled />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">What were you working on?</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Implementing user authentication, debugging API endpoint, etc."
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Open URLs (optional)</label>
                {urls.map((url, index) => (
                  <Input
                    key={index}
                    value={url}
                    onChange={(e) => updateUrl(index, e.target.value)}
                    placeholder="https://docs.example.com/api"
                    className="mb-2"
                  />
                ))}
                <Button variant="outline" size="sm" onClick={addUrlField} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add URL
                </Button>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={loading || !notes.trim()} className="flex-1">
                  Save Context
                </Button>
                <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setIsFormOpen(true)} disabled={!currentProject} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Save Current Context
            </Button>
          )}

          <div className="space-y-3">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="secondary">{snapshot.project_id}</Badge>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onRestore(snapshot)}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(snapshot.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground mb-2 line-clamp-3">
                  {snapshot.notes}
                </p>
                
                {snapshot.urls.length > 0 && (
                  <div className="text-xs text-muted-foreground mb-2">
                    {snapshot.urls.length} URL{snapshot.urls.length > 1 ? 's' : ''} saved
                  </div>
                )}
                
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(snapshot.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContextSnapshotFAB({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className="fixed bottom-6 right-6 rounded-full shadow-lg h-14 px-6 z-40"
    >
      <Plus className="w-5 h-5 mr-2" />
      Save Context
    </Button>
  );
}