import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, FileText, CheckCircle2 } from "lucide-react";
import backend from "~backend/client";
import type { Project } from "~backend/projects/types";
import type { ContextSnapshot } from "~backend/contexts/types";

interface DeploymentTabProps {
  project: Project;
}

export function DeploymentTab({ project }: DeploymentTabProps) {
  const [context, setContext] = useState<ContextSnapshot | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContext();
  }, [project.id]);

  const loadContext = async () => {
    try {
      const { snapshot } = await backend.contexts.getCurrent({ project_id: project.id });
      setContext(snapshot);
      if (snapshot) {
        setNotes(snapshot.notes ?? "");
      }
    } catch (error) {
      console.error("Failed to load context:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading context...</div>;
  }

  if (!context) {
    return <div className="text-muted-foreground">No context available</div>;
  }

  const workState = context.work_state as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Context Snapshot</h2>
          <p className="text-muted-foreground">Current work state and next steps</p>
        </div>
        <Button>
          <Save className="h-4 w-4 mr-2" />
          Save Context
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Work State</CardTitle>
            <CardDescription>Current task and progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Task</span>
                <span className="font-semibold">{workState.current_task}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold">{workState.progress}%</span>
              </div>
            </div>
            {workState.blockers && workState.blockers.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Blockers</h4>
                <ul className="space-y-1">
                  {workState.blockers.map((blocker: string, i: number) => (
                    <li key={i} className="text-sm text-yellow-500">• {blocker}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>Upcoming tasks and priorities</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {context.next_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Open Files</CardTitle>
            <CardDescription>Currently active files</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-3">
              {context.open_files.map((file, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-mono truncate">{file}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Context-specific notes and observations</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about current work..."
              className="min-h-[120px] font-mono text-sm"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
