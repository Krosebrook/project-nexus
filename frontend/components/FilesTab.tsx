import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Calendar } from "lucide-react";
import backend from "~backend/client";
import type { Project } from "~backend/projects/types";
import type { FileMove } from "~backend/files/types";
import { format } from "date-fns";

interface FilesTabProps {
  project: Project;
}

export function FilesTab({ project }: FilesTabProps) {
  const [moves, setMoves] = useState<FileMove[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMoves();
  }, [project.id]);

  const loadMoves = async () => {
    try {
      const { moves } = await backend.files.list({ project_id: project.id });
      setMoves(moves);
    } catch (error) {
      console.error("Failed to load file moves:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading file history...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">File Organization History</h2>
        <p className="text-muted-foreground">Track file moves and refactoring</p>
      </div>

      <div className="space-y-3">
        {moves.map((move) => (
          <Card key={move.id}>
            <CardHeader>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(move.moved_at), "MMM dd, yyyy 'at' HH:mm")}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md font-mono truncate">
                  {move.original_path}
                </code>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md font-mono truncate">
                  {move.new_path}
                </code>
              </div>
              {move.reason && (
                <p className="text-sm text-muted-foreground italic">{move.reason}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
