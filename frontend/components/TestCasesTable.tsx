import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, XCircle, Circle, Play, RefreshCw, Trash2 } from "lucide-react";
import { TestCase } from "@/lib/test-suite-data";

interface TestCasesTableProps {
  tests: TestCase[];
  onTestClick: (test: TestCase) => void;
  onRunTest: (testId: string) => void;
  onUpdateBaseline: (testId: string) => void;
  onDeleteTest: (testId: string) => void;
  selectedTests: Set<string>;
  onToggleTest: (testId: string) => void;
}

export function TestCasesTable({
  tests,
  onTestClick,
  onRunTest,
  onUpdateBaseline,
  onDeleteTest,
  selectedTests,
  onToggleTest,
}: TestCasesTableProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const truncate = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-12">
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={tests.length > 0 && tests.every(t => selectedTests.has(t.id))}
                  onCheckedChange={(checked) => {
                    tests.forEach(t => {
                      if (checked && !selectedTests.has(t.id)) {
                        onToggleTest(t.id);
                      } else if (!checked && selectedTests.has(t.id)) {
                        onToggleTest(t.id);
                      }
                    });
                  }}
                />
              </div>
            </TableHead>
            <TableHead className="w-20">Status</TableHead>
            <TableHead>Test Name</TableHead>
            <TableHead className="w-1/4">Expected</TableHead>
            <TableHead className="w-1/4">Actual</TableHead>
            <TableHead className="w-32 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tests.map((test) => (
            <TableRow key={test.id} className="hover:bg-muted/30">
              <TableCell>
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={selectedTests.has(test.id)}
                    onCheckedChange={() => onToggleTest(test.id)}
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-center">
                  {getStatusIcon(test.status)}
                </div>
              </TableCell>
              <TableCell>
                <button
                  onClick={() => onTestClick(test)}
                  className="text-left hover:underline text-foreground font-medium"
                >
                  {test.name}
                </button>
                <div className="flex gap-1 mt-1">
                  {test.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <button
                  onClick={() => onTestClick(test)}
                  className="text-left hover:underline text-sm text-muted-foreground"
                >
                  {truncate(test.expectedOutput)}
                </button>
              </TableCell>
              <TableCell>
                {test.actualOutput ? (
                  <button
                    onClick={() => onTestClick(test)}
                    className="text-left hover:underline text-sm text-muted-foreground"
                  >
                    {truncate(test.actualOutput)}
                  </button>
                ) : (
                  <span className="text-sm text-muted-foreground italic">Not run</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRunTest(test.id)}
                    className="h-8 w-8 p-0"
                    title="Run test"
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                  {test.status === "failed" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onUpdateBaseline(test.id)}
                      className="h-8 w-8 p-0"
                      title="Update baseline"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteTest(test.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    title="Delete test"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}