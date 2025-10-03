import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { mockTestSuites, TestSuite, TestCase } from "@/lib/test-suite-data";
import { TestSuiteAccordion } from "./TestSuiteAccordion";
import { TestDetailsModal } from "./TestDetailsModal";
import { RunTestsProgressModal } from "./RunTestsProgressModal";
import { CreateTestModal } from "./CreateTestModal";
import { TestFilters } from "./TestFilters";
import { BulkActions } from "./BulkActions";
import { useToast } from "@/components/ui/use-toast";

interface TestRunResult {
  testId: string;
  testName: string;
  status: "running" | "passed" | "failed";
}

interface AutomationTabProps {
  project?: any;
}

export function AutomationTab({ project }: AutomationTabProps) {
  const [testSuites, setTestSuites] = useState<TestSuite[]>(mockTestSuites);
  const [selectedTest, setSelectedTest] = useState<TestCase | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [testRunResults, setTestRunResults] = useState<TestRunResult[]>([]);
  const [currentRunningTest, setCurrentRunningTest] = useState<string | null>(null);
  const [runStartTime, setRunStartTime] = useState<number>(0);
  const [runDuration, setRunDuration] = useState<number>(0);
  const [isRunComplete, setIsRunComplete] = useState(false);
  
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");

  const { toast } = useToast();

  const allTests = useMemo(() => {
    return testSuites.flatMap(suite => suite.tests);
  }, [testSuites]);

  const availableProjects = useMemo(() => {
    return Array.from(new Set(allTests.map(t => t.project)));
  }, [allTests]);

  const availableTags = useMemo(() => {
    return Array.from(new Set(allTests.flatMap(t => t.tags)));
  }, [allTests]);

  const filteredSuites = useMemo(() => {
    return testSuites.map(suite => ({
      ...suite,
      tests: suite.tests.filter(test => {
        const matchesSearch = test.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            test.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || test.status === statusFilter;
        const matchesProject = projectFilter === "all" || test.project === projectFilter;
        const matchesTag = tagFilter === "all" || test.tags.includes(tagFilter);
        
        return matchesSearch && matchesStatus && matchesProject && matchesTag;
      })
    })).filter(suite => suite.tests.length > 0);
  }, [testSuites, searchQuery, statusFilter, projectFilter, tagFilter]);

  const handleTestClick = (test: TestCase) => {
    setSelectedTest(test);
    setIsDetailsModalOpen(true);
  };

  const handleToggleTest = (testId: string) => {
    setSelectedTests(prev => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  const simulateTestRun = async (tests: TestCase[]): Promise<void> => {
    setIsRunningTests(true);
    setIsRunComplete(false);
    setRunStartTime(Date.now());
    
    const results: TestRunResult[] = tests.map(test => ({
      testId: test.id,
      testName: test.name,
      status: "running" as const,
    }));
    setTestRunResults(results);

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      setCurrentRunningTest(test.name);
      
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
      
      results[i].status = test.status === "not_run" 
        ? (Math.random() > 0.3 ? "passed" : "failed")
        : test.status;
      
      setTestRunResults([...results]);
    }

    setCurrentRunningTest(null);
    setRunDuration((Date.now() - runStartTime) / 1000);
    setIsRunComplete(true);

    const passedCount = results.filter(r => r.status === "passed").length;
    const failedCount = results.filter(r => r.status === "failed").length;
    
    toast({
      title: "Test run complete",
      description: `${passedCount} passed, ${failedCount} failed`,
    });
  };

  const handleRunAll = async (suiteId: string) => {
    const suite = testSuites.find(s => s.id === suiteId);
    if (!suite) return;
    
    await simulateTestRun(suite.tests);
  };

  const handleRunTest = async (testId: string) => {
    const test = allTests.find(t => t.id === testId);
    if (!test) return;
    
    await simulateTestRun([test]);
  };

  const handleRunSelected = async () => {
    const testsToRun = allTests.filter(t => selectedTests.has(t.id));
    if (testsToRun.length === 0) return;
    
    await simulateTestRun(testsToRun);
  };

  const handleUpdateBaseline = (testId: string) => {
    setTestSuites(prevSuites => 
      prevSuites.map(suite => ({
        ...suite,
        tests: suite.tests.map(test => 
          test.id === testId
            ? { ...test, expectedOutput: test.actualOutput || test.expectedOutput, status: "passed" as const }
            : test
        )
      }))
    );
    
    toast({
      title: "Baseline updated",
      description: "Expected output has been updated to match actual output",
    });
  };

  const handleUpdateAllBaselines = () => {
    setTestSuites(prevSuites => 
      prevSuites.map(suite => ({
        ...suite,
        tests: suite.tests.map(test => 
          test.status === "failed" && test.actualOutput
            ? { ...test, expectedOutput: test.actualOutput, status: "passed" as const }
            : test
        )
      }))
    );
    
    toast({
      title: "All baselines updated",
      description: "All failed test baselines have been updated",
    });
    
    setIsRunningTests(false);
  };

  const handleDeleteTest = (testId: string) => {
    setTestSuites(prevSuites => 
      prevSuites.map(suite => ({
        ...suite,
        tests: suite.tests.filter(test => test.id !== testId)
      }))
    );
    
    setSelectedTests(prev => {
      const next = new Set(prev);
      next.delete(testId);
      return next;
    });
    
    toast({
      title: "Test deleted",
      description: "The test has been removed from the suite",
    });
  };

  const handleDeleteSelected = () => {
    const testIds = Array.from(selectedTests);
    setTestSuites(prevSuites => 
      prevSuites.map(suite => ({
        ...suite,
        tests: suite.tests.filter(test => !testIds.includes(test.id))
      }))
    );
    
    setSelectedTests(new Set());
    
    toast({
      title: `${testIds.length} tests deleted`,
      description: "Selected tests have been removed from the suites",
    });
  };

  const handleCreateTest = (testData: {
    name: string;
    description: string;
    project: string;
    promptInput: string;
    expectedOutput: string;
    tags: string[];
  }) => {
    const newTest: TestCase = {
      id: `test-new-${Date.now()}`,
      name: testData.name,
      description: testData.description,
      project: testData.project,
      tags: testData.tags,
      promptInput: testData.promptInput,
      expectedOutput: testData.expectedOutput,
      status: "not_run",
    };

    let targetSuiteId = testSuites[0]?.id;
    if (testData.project === "INT-support-bot") {
      targetSuiteId = testSuites[1]?.id || targetSuiteId;
    } else if (testData.project === "INT-api-gateway") {
      targetSuiteId = testSuites[2]?.id || targetSuiteId;
    }

    setTestSuites(prevSuites => 
      prevSuites.map(suite => 
        suite.id === targetSuiteId
          ? { ...suite, tests: [...suite.tests, newTest] }
          : suite
      )
    );

    toast({
      title: "Test created",
      description: `"${testData.name}" has been added to the test suite`,
    });
  };

  const handleExportResults = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      suites: testSuites.map(suite => ({
        name: suite.name,
        description: suite.description,
        tests: suite.tests.map(test => ({
          name: test.name,
          status: test.status,
          project: test.project,
          tags: test.tags,
          lastRun: test.lastRun,
          duration: test.duration,
        }))
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Results exported",
      description: "Test results have been exported to JSON",
    });
  };

  const handleViewFailures = () => {
    setIsRunningTests(false);
    setStatusFilter("failed");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Prompt Regression Testing</h2>
          <p className="text-muted-foreground">Automated testing for prompt accuracy and consistency</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Test
        </Button>
      </div>

      <TestFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        projectFilter={projectFilter}
        onProjectFilterChange={setProjectFilter}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
        availableProjects={availableProjects}
        availableTags={availableTags}
      />

      <BulkActions
        selectedCount={selectedTests.size}
        onRunSelected={handleRunSelected}
        onDeleteSelected={handleDeleteSelected}
        onExportResults={handleExportResults}
      />

      <div className="space-y-4">
        {filteredSuites.map((suite) => (
          <TestSuiteAccordion
            key={suite.id}
            suite={suite}
            onRunAll={handleRunAll}
            onRunTest={handleRunTest}
            onTestClick={handleTestClick}
            onUpdateBaseline={handleUpdateBaseline}
            onDeleteTest={handleDeleteTest}
            selectedTests={selectedTests}
            onToggleTest={handleToggleTest}
          />
        ))}
      </div>

      {filteredSuites.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No tests found matching your filters
        </div>
      )}

      <TestDetailsModal
        test={selectedTest}
        open={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        onRunTest={handleRunTest}
        onUpdateBaseline={handleUpdateBaseline}
        onDeleteTest={handleDeleteTest}
      />

      <RunTestsProgressModal
        open={isRunningTests}
        onClose={() => setIsRunningTests(false)}
        results={testRunResults}
        currentTest={currentRunningTest}
        totalTests={testRunResults.length}
        completedTests={testRunResults.filter(r => r.status !== "running").length}
        onViewFailures={handleViewFailures}
        onUpdateAllBaselines={handleUpdateAllBaselines}
        isComplete={isRunComplete}
        duration={runDuration}
      />

      <CreateTestModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateTest={handleCreateTest}
      />
    </div>
  );
}