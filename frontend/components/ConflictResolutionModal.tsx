import React, { useEffect, useState } from 'react';
import { db, SyncConflict } from '../db/schema';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { AlertTriangle } from 'lucide-react';
import { Card } from './ui/card';

export function ConflictResolutionModal() {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [currentConflict, setCurrentConflict] = useState<SyncConflict | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const loadConflicts = async () => {
      const pendingConflicts = await db.sync_conflicts
        .where('resolution')
        .equals('pending')
        .toArray();

      setConflicts(pendingConflicts);

      if (pendingConflicts.length > 0 && !currentConflict) {
        setCurrentConflict(pendingConflicts[0]);
        setShowModal(true);
      }
    };

    loadConflicts();

    const interval = setInterval(loadConflicts, 10000);

    return () => clearInterval(interval);
  }, [currentConflict]);

  const handleResolve = async (resolution: 'local-wins' | 'remote-wins' | 'merged') => {
    if (!currentConflict || !currentConflict.id) return;

    await db.sync_conflicts.update(currentConflict.id, {
      resolution,
      resolved_at: new Date().toISOString(),
    });

    if (resolution === 'remote-wins') {
      const table = getTable(currentConflict.entity);
      await table.put(currentConflict.remote_data);
    } else if (resolution === 'local-wins') {
      const table = getTable(currentConflict.entity);
      await table.put(currentConflict.local_data);
    }

    const remainingConflicts = conflicts.filter(c => c.id !== currentConflict.id);
    setConflicts(remainingConflicts);

    if (remainingConflicts.length > 0) {
      setCurrentConflict(remainingConflicts[0]);
    } else {
      setCurrentConflict(null);
      setShowModal(false);
    }
  };

  const getTable = (entity: string) => {
    switch (entity) {
      case 'deployment':
        return db.deployments;
      case 'project':
        return db.projects;
      case 'artifact':
        return db.artifacts;
      case 'queue_item':
        return db.queue_items;
      default:
        throw new Error(`Unknown entity: ${entity}`);
    }
  };

  if (!currentConflict) return null;

  return (
    <Dialog open={showModal} onOpenChange={setShowModal}>
      <DialogContent className="conflict-modal max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Sync Conflict Detected
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            A conflict was detected for <strong>{currentConflict.entity}</strong>. 
            Local changes conflict with remote changes. Please choose which version to keep.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 border-blue-200 bg-blue-50">
              <h3 className="font-semibold text-blue-900 mb-2">
                Local Version (v{currentConflict.local_version})
              </h3>
              <pre className="text-xs bg-white p-3 rounded overflow-auto max-h-48">
                {JSON.stringify(currentConflict.local_data, null, 2)}
              </pre>
            </Card>

            <Card className="p-4 border-purple-200 bg-purple-50">
              <h3 className="font-semibold text-purple-900 mb-2">
                Remote Version (v{currentConflict.remote_version})
              </h3>
              <pre className="text-xs bg-white p-3 rounded overflow-auto max-h-48">
                {JSON.stringify(currentConflict.remote_data, null, 2)}
              </pre>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <div className="flex gap-2 w-full justify-between">
            <span className="text-sm text-gray-500">
              {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} remaining
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleResolve('local-wins')}
              >
                Keep Local
              </Button>
              <Button
                variant="outline"
                onClick={() => handleResolve('remote-wins')}
              >
                Keep Remote
              </Button>
              <Button
                onClick={() => handleResolve('remote-wins')}
              >
                Use Server Version (Recommended)
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
