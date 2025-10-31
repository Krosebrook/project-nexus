import React, { useEffect, useState } from 'react';
import { syncEngine } from '../lib/sync-engine';
import { Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { Badge } from './ui/badge';

export function SyncStatusIndicator() {
  const [status, setStatus] = useState<{
    isOnline: boolean;
    isSyncing: boolean;
    lastSyncAt: string | null;
    pendingEvents: number;
    pendingConflicts: number;
  } | null>(null);

  useEffect(() => {
    const updateStatus = async () => {
      const currentStatus = await syncEngine.getStatus();
      setStatus(currentStatus);
    };

    updateStatus();

    syncEngine.on('sync-complete', updateStatus);
    syncEngine.on('online', updateStatus);
    syncEngine.on('offline', updateStatus);

    const interval = setInterval(updateStatus, 5000);

    return () => {
      syncEngine.off('sync-complete', updateStatus);
      syncEngine.off('online', updateStatus);
      syncEngine.off('offline', updateStatus);
      clearInterval(interval);
    };
  }, []);

  if (!status) return null;

  return (
    <div className="sync-status flex items-center gap-3">
      {status.isOnline ? (
        <Badge variant="outline" className="flex items-center gap-1.5 bg-green-50 text-green-700 border-green-200">
          {status.isSyncing ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Cloud className="w-3 h-3" />
          )}
          <span>Online</span>
        </Badge>
      ) : (
        <Badge variant="outline" className="flex items-center gap-1.5 bg-gray-50 text-gray-700 border-gray-200 offline-banner">
          <CloudOff className="w-3 h-3" />
          <span>Offline</span>
        </Badge>
      )}

      {status.pendingEvents > 0 && (
        <Badge variant="outline" className="flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3" />
          <span>{status.pendingEvents} pending</span>
        </Badge>
      )}

      {status.pendingConflicts > 0 && (
        <Badge variant="outline" className="flex items-center gap-1.5 bg-orange-50 text-orange-700 border-orange-200">
          <AlertTriangle className="w-3 h-3" />
          <span>{status.pendingConflicts} conflicts</span>
        </Badge>
      )}

      {status.lastSyncAt && (
        <span className="text-xs text-gray-500">
          Last sync: {formatRelativeTime(status.lastSyncAt)}
        </span>
      )}
    </div>
  );
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}
