import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle2, XCircle, Clock } from "lucide-react";
import { TestCaseSkeleton } from "@/components/LoadingSkeleton";
import backend from "~backend/client";
import type { Project } from "~backend/projects/types";
import type { TestCase } from "~backend/tests/types";
import { formatDistanceToNow } from "date-fns";

interface AutomationTabProps {
  project: Project;
}

export function AutomationTab({ project }: AutomationTabProps) {
  const [tests, setTests] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningTests, setRunningTests] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadTests();
  }, [project.id]);

  const loadTests = async () => {
    setLoading(true);
    try {
      const { tests } = await backend.tests.list({ project_id: project.id });
      setTests(tests);
    } catch (error) {
      console.error("Failed to load tests:", error);
    } finally {
      setLoading(false);
    }
  };

  const runTest = async (testId: number) => {
    setRunningTests(prev => new Set(prev).add(testId));
    try {
      await backend.tests.run({ 
        id: testId,
        actual_output: {},
      });
      await loadTests();
    } catch (error) {
      console.error("Failed to run test:", error);
    } finally {
      setRunningTests(prev => {
        const next = new Set(prev);
        next.delete(testId);
        return next;
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "passed": return "bg-green-500";
      case "failed": return "bg-red-500";
      default: return "bg-yellow-500";
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <TestCaseSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (false) {
    return <div className="text-muted-foreground">Loading tests...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Regression Test Baselines</h2>
          <p className="text-muted-foreground">Automated prompt and model testing</p>
        </div>
        <Button>
          <Play className="h-4 w-4 mr-2" />
          Run All Tests
        </Button>
      </div>

      <div className="space-y-4">
        {tests.map((test) => (
          <Card key={test.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(test.status)}
                    <CardTitle className="text-lg">{test.name}</CardTitle>
                  </div>
                  <CardDescription>
                    {test.last_run 
                      ? `Last run ${formatDistanceToNow(new Date(test.last_run), { addSuffix: true })}`
                      : "Never run"
                    }
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(test.status)} variant="default">
                  {test.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">Input</h4>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-32">
                    {JSON.stringify(test.input, null, 2)}
                  </pre>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">Expected Output</h4>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-32">
                    {JSON.stringify(test.expected_output, null, 2)}
                  </pre>
                </div>
              </div>
              {test.actual_output && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">Actual Output</h4>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-32">
                    {JSON.stringify(test.actual_output, null, 2)}
                  </pre>
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => runTest(test.id)}
                disabled={runningTests.has(test.id)}
              >
                <Play className="h-3 w-3 mr-2" />
                {runningTests.has(test.id) ? "Running..." : "Run Test"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
