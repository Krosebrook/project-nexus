import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { TestCase } from "@/lib/test-suite-data";

interface TestRunResult {
  testId: string;
  testName: string;
  status: "running" | "passed" | "failed";
}

interface RunTestsProgressModalProps {
  open: boolean;
  onClose: () => void;
  results: TestRunResult[];
  currentTest: string | null;
  totalTests: number;
  completedTests: number;
  onViewFailures: () => void;
  onUpdateAllBaselines: () => void;
  isComplete: boolean;
  duration?: number;
}

export function RunTestsProgressModal({
  open,
  onClose,
  results,
  currentTest,
  totalTests,
  completedTests,
  onViewFailures,
  onUpdateAllBaselines,
  isComplete,
  duration,
}: RunTestsProgressModalProps) {
  const passedCount = results.filter(r => r.status === "passed").length;
  const failedCount = results.filter(r => r.status === "failed").length;
  const progress = totalTests > 0 ? (completedTests / totalTests) * 100 : 0;

  const getResultIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isComplete ? "Test Run Complete" : "Running Tests"}
          </DialogTitle>
          <DialogDescription>
            {isComplete
              ? `Completed ${totalTests} test${totalTests !== 1 ? 's' : ''} in ${duration?.toFixed(1)}s`
              : `Running ${completedTests} of ${totalTests} tests...`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium text-foreground">
                {completedTests} / {totalTests}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {!isComplete && currentTest && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 animate-pulse" />
              <span>Currently running: <span className="text-foreground font-medium">{currentTest}</span></span>
            </div>
          )}

          {isComplete && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 border rounded-lg bg-green-500/10 border-green-500/20">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <div className="text-2xl font-bold text-foreground">{passedCount}</div>
                  <div className="text-sm text-muted-foreground">Passed</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 border rounded-lg bg-red-500/10 border-red-500/20">
                <XCircle className="h-8 w-8 text-red-500" />
                <div>
                  <div className="text-2xl font-bold text-foreground">{failedCount}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
            <h4 className="text-sm font-semibold text-foreground mb-2">Test Results</h4>
            {results.map((result) => (
              <div
                key={result.testId}
                className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors"
              >
                {getResultIcon(result.status)}
                <span className="text-sm text-foreground flex-1">{result.testName}</span>
                {result.status === "running" && (
                  <span className="text-xs text-muted-foreground">Running...</span>
                )}
              </div>
            ))}
          </div>

          {isComplete && (
            <div className="flex gap-2 pt-4 border-t">
              {failedCount > 0 ? (
                <>
                  <Button onClick={onViewFailures} variant="outline" className="gap-2">
                    <AlertCircle className="h-4 w-4" />
                    View Failed Tests
                  </Button>
                  <Button onClick={onUpdateAllBaselines} className="gap-2">
                    Update All Baselines
                  </Button>
                </>
              ) : (
                <Button onClick={onClose} className="w-full">
                  Close
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}