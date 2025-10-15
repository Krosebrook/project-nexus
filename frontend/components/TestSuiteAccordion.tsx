import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Play } from "lucide-react";
import { TestSuite, TestCase } from "@/lib/test-suite-data";
import { TestCasesTable } from "./TestCasesTable";
import { formatDistanceToNow } from "date-fns";

interface TestSuiteAccordionProps {
  suite: TestSuite;
  onRunAll: (suiteId: string) => void;
  onRunTest: (testId: string) => void;
  onTestClick: (test: TestCase) => void;
  onUpdateBaseline: (testId: string) => void;
  onDeleteTest: (testId: string) => void;
  selectedTests: Set<string>;
  onToggleTest: (testId: string) => void;
}

export function TestSuiteAccordion({
  suite,
  onRunAll,
  onRunTest,
  onTestClick,
  onUpdateBaseline,
  onDeleteTest,
  selectedTests,
  onToggleTest,
}: TestSuiteAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const passedCount = suite.tests.filter(t => t.status === "passed").length;
  const totalCount = suite.tests.length;
  const allPassed = passedCount === totalCount;
  const hasFailures = suite.tests.some(t => t.status === "failed");

  const getResultsBadgeVariant = () => {
    if (allPassed) return "default";
    if (hasFailures) return "destructive";
    return "secondary";
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold text-foreground">
                {suite.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {suite.description}
              </p>
              {suite.lastRun && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last run {formatDistanceToNow(suite.lastRun, { addSuffix: true })} 
                  {suite.duration && ` • ${suite.duration}s`}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={getResultsBadgeVariant()} className="font-medium">
              {passedCount}/{totalCount} Passed
            </Badge>
            <Button
              size="sm"
              onClick={() => onRunAll(suite.id)}
              className="gap-2"
            >
              <Play className="h-3 w-3" />
              Run All
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <TestCasesTable
            tests={suite.tests}
            onTestClick={onTestClick}
            onRunTest={onRunTest}
            onUpdateBaseline={onUpdateBaseline}
            onDeleteTest={onDeleteTest}
            selectedTests={selectedTests}
            onToggleTest={onToggleTest}
          />
        </CardContent>
      )}
    </Card>
  );
}