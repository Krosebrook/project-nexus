/**
 * Code Executor Tests
 */
import { describe, it, expect } from "vitest";
import { CodeExecutor } from "./code-executor";

describe("CodeExecutor", () => {
  const executor = new CodeExecutor();

  describe("executeCode - JavaScript", () => {
    it("should execute simple console.log", async () => {
      const result = await executor.executeCode(
        'console.log("Hello World")',
        "javascript"
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("Hello World");
      expect(result.stderr).toBe("");
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it("should execute multiple console.log statements", async () => {
      const code = `
        console.log("Line 1")
        console.log("Line 2")
        console.log("Line 3")
      `;
      const result = await executor.executeCode(code, "javascript");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Line 1");
      expect(result.stdout).toContain("Line 2");
      expect(result.stdout).toContain("Line 3");
    });

    it("should execute math expressions", async () => {
      const result = await executor.executeCode("10 + 5", "javascript");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("15");
    });

    it("should handle console.log with numbers", async () => {
      const result = await executor.executeCode("console.log(42)", "javascript");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("42");
    });

    it("should handle console.log with math expressions", async () => {
      const result = await executor.executeCode(
        "console.log(10 + 20)",
        "javascript"
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("30");
    });

    it("should handle return statements", async () => {
      const code = `
        function test() {
          return "test result";
        }
      `;
      const result = await executor.executeCode(code, "javascript");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("test result");
    });

    it("should handle syntax errors", async () => {
      const result = await executor.executeCode(
        "syntax error here",
        "javascript"
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("SyntaxError");
    });

    it("should handle runtime errors", async () => {
      const result = await executor.executeCode(
        'throw new Error("Runtime error")',
        "javascript"
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Runtime error");
    });

    it("should handle code without specific patterns", async () => {
      const result = await executor.executeCode(
        "const x = 42;",
        "javascript"
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("Code executed successfully");
    });
  });

  describe("executeCode - TypeScript", () => {
    it("should execute TypeScript code", async () => {
      const result = await executor.executeCode(
        'console.log("TypeScript test")',
        "typescript"
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("TypeScript test");
    });

    it("should handle TypeScript with types", async () => {
      const code = `
        const message: string = "Hello";
        console.log(message)
      `;
      const result = await executor.executeCode(code, "typescript");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Hello");
    });
  });

  describe("executeCode - Bash", () => {
    it("should execute echo command", async () => {
      const result = await executor.executeCode('echo "Hello Bash"', "bash");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("Hello Bash");
      expect(result.stderr).toBe("");
    });

    it("should execute pwd command", async () => {
      const result = await executor.executeCode("pwd", "bash");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("/home/sandbox");
    });

    it("should execute ls command", async () => {
      const result = await executor.executeCode("ls", "bash");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("file1.txt");
      expect(result.stdout).toContain("file2.txt");
    });

    it("should execute whoami command", async () => {
      const result = await executor.executeCode("whoami", "bash");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("sandbox-user");
    });

    it("should execute date command", async () => {
      const result = await executor.executeCode("date", "bash");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/^\d{4}-\d{2}-\d{2}/);
    });

    it("should execute cat command", async () => {
      const result = await executor.executeCode("cat file.txt", "bash");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("File contents");
    });

    it("should handle bash errors", async () => {
      const result = await executor.executeCode("error command", "bash");

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("command failed");
    });

    it("should handle generic bash commands", async () => {
      const result = await executor.executeCode("some-command", "bash");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Executed: some-command");
    });
  });

  describe("validateCode", () => {
    it("should validate safe code", () => {
      const result = executor.validateCode('console.log("test")', "javascript");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject code with require", () => {
      const result = executor.validateCode('require("fs")', "javascript");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("unsafe code");
    });

    it("should reject code with import", () => {
      const result = executor.validateCode(
        'import fs from "fs"',
        "javascript"
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("unsafe code");
    });

    it("should reject code with eval", () => {
      const result = executor.validateCode('eval("malicious")', "javascript");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("unsafe code");
    });

    it("should reject code with process", () => {
      const result = executor.validateCode("process.exit()", "javascript");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("unsafe code");
    });

    it("should reject code exceeding max length", () => {
      const longCode = "a".repeat(10001);
      const result = executor.validateCode(longCode, "javascript");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum length");
    });

    it("should accept code at max length boundary", () => {
      const code = "a".repeat(10000);
      const result = executor.validateCode(code, "javascript");

      expect(result.valid).toBe(true);
    });
  });

  describe("execution time tracking", () => {
    it("should track execution time", async () => {
      const result = await executor.executeCode('console.log("test")', "javascript");

      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.executionTime).toBeLessThan(5000);
    });

    it("should track execution time for bash", async () => {
      const result = await executor.executeCode("pwd", "bash");

      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.executionTime).toBeLessThan(5000);
    });
  });
});
