import { describe, it, expect } from "vitest";
import { create as createProject } from "../projects/create";
import { create as createTest } from "./create";
import { run as runTest } from "./run";
import { list as listTests } from "./list";

describe("API Integration Tests", () => {
  describe("Project and Test workflow", () => {
    it("should create project and run test", async () => {
      const project = await createProject({
        name: `Integration Test Project ${Date.now()}`,
        description: "For integration testing",
        status: "development",
      });

      expect(project.id).toBeDefined();

      const test = await createTest({
        project_id: project.id,
        name: "Integration Test",
        input: { duration: 60, users: 100 },
        expected_output: { status: "success" },
      });

      expect(test.id).toBeDefined();
      expect(test.project_id).toBe(project.id);

      const runResult = await runTest({ 
        id: test.id,
        actual_output: { status: "success" },
      });

      expect(runResult.id).toBeDefined();
      expect(runResult.status).toBe("passed");
    });

    it("should list tests for project", async () => {
      const project = await createProject({
        name: `Test List Project ${Date.now()}`,
        description: "For testing list",
        status: "development",
      });

      await createTest({
        project_id: project.id,
        name: "Test 1",
        input: {},
        expected_output: {},
      });

      await createTest({
        project_id: project.id,
        name: "Test 2",
        input: {},
        expected_output: {},
      });

      const result = await listTests({ project_id: project.id });

      expect(result.tests.length).toBeGreaterThanOrEqual(2);
      expect(result.tests.every(t => t.project_id === project.id)).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should handle invalid project_id", async () => {
      await expect(async () => {
        await createTest({
          project_id: 999999,
          name: "Test",
          input: {},
          expected_output: {},
        });
      }).rejects.toThrow();
    });

    it("should handle invalid test_id for run", async () => {
      await expect(async () => {
        await runTest({ 
          id: 999999,
          actual_output: {},
        });
      }).rejects.toThrow();
    });
  });
});
