export type TestStatus = "pending" | "passed" | "failed";

export interface TestCase {
  id: number;
  project_id: number;
  name: string;
  input: Record<string, any>;
  expected_output: Record<string, any>;
  actual_output: Record<string, any> | null;
  status: TestStatus;
  last_run: Date | null;
  created_at: Date;
  updated_at: Date;
}
