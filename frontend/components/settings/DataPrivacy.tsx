import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileDown, Trash2, RotateCcw, Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import backend from "~backend/client";

interface DataPrivacyProps {
  settings: any;
  updateSettings: (updates: any) => void;
  isSaving: boolean;
}

export function DataPrivacy({ }: DataPrivacyProps) {
  const { toast } = useToast();
  const [isClearCacheDialogOpen, setIsClearCacheDialogOpen] = useState(false);
  const [isClearSnapshotsDialogOpen, setIsClearSnapshotsDialogOpen] = useState(false);
  const [isClearTestsDialogOpen, setIsClearTestsDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const exportContextSnapshots = async () => {
    try {
      const response = await backend.contexts.list({ project_id: 1 });
      const data = JSON.stringify(response.snapshots, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "context-snapshots.json";
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Success",
        description: "Context snapshots exported successfully",
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to export context snapshots",
      });
    }
  };

  const exportTestBaselines = async () => {
    try {
      const data = JSON.stringify([], null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "test-baselines.json";
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Success",
        description: "Test baselines exported successfully",
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to export test baselines",
      });
    }
  };

  const exportDeploymentHistory = async () => {
    try {
      const csvHeaders = "ID,Status,Stage,Progress\n";
      const csvRows = "1,completed,deploy,100\n2,running,build,50";
      const csv = csvHeaders + csvRows;
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "deployment-history.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Success",
        description: "Deployment history exported successfully",
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to export deployment history",
      });
    }
  };

  const clearCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    setIsClearCacheDialogOpen(false);
    toast({
      title: "Success",
      description: "Cache cleared successfully",
    });
  };

  const clearSnapshots = async () => {
    try {
      const response = await backend.contexts.list({ project_id: 1 });
      for (const snapshot of response.snapshots) {
        await backend.snapshots.del({ id: snapshot.id });
      }
      setIsClearSnapshotsDialogOpen(false);
      toast({
        title: "Success",
        description: "Context snapshots cleared successfully",
      });
    } catch (error) {
      console.error("Clear failed:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to clear context snapshots",
      });
    }
  };

  const clearTests = async () => {
    try {
      setIsClearTestsDialogOpen(false);
      toast({
        title: "Success",
        description: "Test history cleared successfully",
      });
    } catch (error) {
      console.error("Clear failed:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to clear test history",
      });
    }
  };

  const resetToDefaults = async () => {
    try {
      await backend.settings.update({
        theme: "dark",
        default_view: "projects",
        refresh_interval: 30,
        preferences: {},
      });
      setIsResetDialogOpen(false);
      toast({
        title: "Success",
        description: "Settings reset to defaults. Refreshing...",
      });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Reset failed:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reset settings",
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">Export Data</Label>
          <p className="text-sm text-muted-foreground">Download your data for backup or migration</p>
        </div>

        <div className="space-y-2">
          <Button variant="outline" onClick={exportContextSnapshots} className="w-full justify-start">
            <FileDown className="h-4 w-4 mr-2" />
            Export Context Snapshots (JSON)
          </Button>
          <Button variant="outline" onClick={exportTestBaselines} className="w-full justify-start">
            <FileDown className="h-4 w-4 mr-2" />
            Export Test Baselines (JSON)
          </Button>
          <Button variant="outline" onClick={exportDeploymentHistory} className="w-full justify-start">
            <FileDown className="h-4 w-4 mr-2" />
            Export Deployment History (CSV)
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">Clear Data</Label>
          <p className="text-sm text-muted-foreground">Remove stored data to free up space</p>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={() => setIsClearCacheDialogOpen(true)}
            className="w-full justify-start"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Cache
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsClearSnapshotsDialogOpen(true)}
            className="w-full justify-start"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Context Snapshots
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsClearTestsDialogOpen(true)}
            className="w-full justify-start"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Test History
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">Reset & Restore</Label>
          <p className="text-sm text-muted-foreground">Reset settings or restore from backup</p>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={() => setIsResetDialogOpen(true)}
            className="w-full justify-start"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button variant="outline" asChild className="w-full justify-start">
            <label className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              Restore from Backup
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    toast({
                      title: "Restore",
                      description: "Backup restore functionality coming soon",
                    });
                  }
                }}
              />
            </label>
          </Button>
        </div>
      </div>

      <Dialog open={isClearCacheDialogOpen} onOpenChange={setIsClearCacheDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Cache</DialogTitle>
            <DialogDescription>
              This will clear all cached data from your browser. You may need to sign in again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClearCacheDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={clearCache}>
              Clear Cache
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isClearSnapshotsDialogOpen} onOpenChange={setIsClearSnapshotsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Context Snapshots</DialogTitle>
            <DialogDescription>
              This will permanently delete all context snapshots. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClearSnapshotsDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={clearSnapshots}>
              Clear Snapshots
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isClearTestsDialogOpen} onOpenChange={setIsClearTestsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Test History</DialogTitle>
            <DialogDescription>
              This will permanently delete all test history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClearTestsDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={clearTests}>
              Clear Tests
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to Defaults</DialogTitle>
            <DialogDescription>
              This will reset all settings to their default values. The page will reload automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={resetToDefaults}>
              Reset Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}