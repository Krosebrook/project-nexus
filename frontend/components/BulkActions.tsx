import { Button } from "@/components/ui/button";
import { Play, Trash2, Download } from "lucide-react";

interface BulkActionsProps {
  selectedCount: number;
  onRunSelected: () => void;
  onDeleteSelected: () => void;
  onExportResults: () => void;
}

export function BulkActions({
  selectedCount,
  onRunSelected,
  onDeleteSelected,
  onExportResults,
}: BulkActionsProps) {
  if (selectedCount === 0) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-muted-foreground">
          No tests selected
        </span>
        <Button variant="outline" size="sm" onClick={onExportResults} className="gap-2">
          <Download className="h-3 w-3" />
          Export Results
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg border">
      <span className="text-sm font-medium text-foreground">
        {selectedCount} test{selectedCount !== 1 ? 's' : ''} selected
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRunSelected} className="gap-2">
          <Play className="h-3 w-3" />
          Run Selected
        </Button>
        <Button variant="outline" size="sm" onClick={onExportResults} className="gap-2">
          <Download className="h-3 w-3" />
          Export
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDeleteSelected}
          className="gap-2"
        >
          <Trash2 className="h-3 w-3" />
          Delete Selected
        </Button>
      </div>
    </div>
  );
}