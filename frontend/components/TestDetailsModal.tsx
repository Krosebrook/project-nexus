import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, RefreshCw, Edit, Trash2, CheckCircle2, XCircle, Circle } from "lucide-react";
import { TestCase } from "@/lib/test-suite-data";

interface TestDetailsModalProps {
  test: TestCase | null;
  open: boolean;
  onClose: () => void;
  onRunTest: (testId: string) => void;
  onUpdateBaseline: (testId: string) => void;
  onDeleteTest: (testId: string) => void;
}

export function TestDetailsModal({
  test,
  open,
  onClose,
  onRunTest,
  onUpdateBaseline,
  onDeleteTest,
}: TestDetailsModalProps) {
  if (!test) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "passed":
        return "default";
      case "failed":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const renderDiffView = () => {
    if (!test.actualOutput || test.status !== "failed") return null;

    const expectedLines = test.expectedOutput.split('\n');
    const actualLines = test.actualOutput.split('\n');
    const maxLines = Math.max(expectedLines.length, actualLines.length);

    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Expected Output</h4>
          <div className="border rounded-md bg-muted/50">
            <pre className="text-xs p-4 overflow-auto max-h-96 font-mono">
              {expectedLines.map((line, i) => {
                const isDifferent = actualLines[i] !== line;
                return (
                  <div
                    key={i}
                    className={isDifferent ? "bg-red-500/20 -mx-4 px-4" : ""}
                  >
                    {line || '\u00A0'}
                  </div>
                );
              })}
            </pre>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Actual Output</h4>
          <div className="border rounded-md bg-muted/50">
            <pre className="text-xs p-4 overflow-auto max-h-96 font-mono">
              {actualLines.map((line, i) => {
                const isDifferent = expectedLines[i] !== line;
                return (
                  <div
                    key={i}
                    className={isDifferent ? "bg-green-500/20 -mx-4 px-4" : ""}
                  >
                    {line || '\u00A0'}
                  </div>
                );
              })}
            </pre>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(test.status)}
              <div>
                <DialogTitle className="text-xl">{test.name}</DialogTitle>
                <DialogDescription className="mt-1">
                  {test.description}
                </DialogDescription>
              </div>
            </div>
            <Badge variant={getStatusBadgeVariant(test.status)}>
              {test.status.toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="flex gap-2 flex-wrap">
            <div className="text-sm">
              <span className="text-muted-foreground">Project:</span>{" "}
              <span className="font-medium text-foreground">{test.project}</span>
            </div>
            <div className="flex gap-1">
              {test.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {test.lastRun && (
            <div className="text-sm text-muted-foreground">
              Last run: {test.lastRun.toLocaleString()}
              {test.duration && ` • Duration: ${test.duration}s`}
            </div>
          )}

          <Tabs defaultValue="details" className="w-full">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              {test.status === "failed" && test.actualOutput && (
                <TabsTrigger value="diff">Diff View</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Prompt Input</h4>
                <div className="border rounded-md bg-muted/50">
                  <pre className="text-xs p-4 overflow-auto max-h-64 font-mono text-foreground whitespace-pre-wrap">
                    {test.promptInput}
                  </pre>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Expected Output</h4>
                <div className="border rounded-md bg-muted/50">
                  <pre className="text-xs p-4 overflow-auto max-h-64 font-mono text-foreground whitespace-pre-wrap">
                    {test.expectedOutput}
                  </pre>
                </div>
              </div>

              {test.actualOutput && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Actual Output</h4>
                  <div className="border rounded-md bg-muted/50">
                    <pre className="text-xs p-4 overflow-auto max-h-64 font-mono text-foreground whitespace-pre-wrap">
                      {test.actualOutput}
                    </pre>
                  </div>
                </div>
              )}
            </TabsContent>

            {test.status === "failed" && test.actualOutput && (
              <TabsContent value="diff" className="mt-4">
                {renderDiffView()}
              </TabsContent>
            )}
          </Tabs>

          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={() => onRunTest(test.id)} className="gap-2">
              <Play className="h-4 w-4" />
              Run Test
            </Button>
            {test.status === "failed" && (
              <Button onClick={() => onUpdateBaseline(test.id)} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Update Baseline
              </Button>
            )}
            <Button variant="outline" className="gap-2">
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            <Button
              onClick={() => {
                onDeleteTest(test.id);
                onClose();
              }}
              variant="destructive"
              className="gap-2 ml-auto"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}