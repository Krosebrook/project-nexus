import React, { useEffect, useState } from 'react';
import { db } from '../db/schema';
import { AlertCircle } from 'lucide-react';
import { Card } from './ui/card';
import { Progress } from './ui/progress';

export function StorageMonitor() {
  const [storage, setStorage] = useState<{ usage: number; quota: number; percentage: number } | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const checkStorage = async () => {
      const estimate = await db.getStorageEstimate();
      setStorage(estimate);
      setShowWarning(estimate.percentage > 80);
    };

    checkStorage();
    const interval = setInterval(checkStorage, 60000);

    return () => clearInterval(interval);
  }, []);

  const handlePrune = async () => {
    await db.pruneOldData(90);
    const estimate = await db.getStorageEstimate();
    setStorage(estimate);
    setShowWarning(estimate.percentage > 80);
  };

  if (!storage) return null;

  return (
    <>
      {showWarning && (
        <div className="storage-warning fixed top-4 right-4 z-50">
          <Card className="bg-orange-50 border-orange-200 p-4 max-w-md">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900">Storage Almost Full</h3>
                <p className="text-sm text-orange-700 mt-1">
                  Using {Math.round(storage.percentage)}% of available storage ({formatBytes(storage.usage)} / {formatBytes(storage.quota)})
                </p>
                <button
                  onClick={handlePrune}
                  className="mt-2 px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
                >
                  Clean Up Old Data
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="storage-info p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Local Storage</span>
          <span className="text-sm text-gray-600">
            {formatBytes(storage.usage)} / {formatBytes(storage.quota)}
          </span>
        </div>
        <Progress value={storage.percentage} className="h-2" />
        <p className="text-xs text-gray-500 mt-1">{Math.round(storage.percentage)}% used</p>
      </div>
    </>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i];
}
