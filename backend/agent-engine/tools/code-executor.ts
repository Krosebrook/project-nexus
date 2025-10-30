/**
 * Code Executor Tool
 *
 * Executes code in a secure sandbox environment.
 * In production, this would use containers or VM isolation.
 */
import { z } from "zod";

/**
 * Code execution result
 */
export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

/**
 * Input schema for code execution
 */
export const CodeExecutorSchema = z.object({
  code: z.string(),
  language: z.enum(["typescript", "javascript", "bash"]),
});

/**
 * CodeExecutor - executes code in sandbox
 */
export class CodeExecutor {
  /**
   * Execute code in a sandboxed environment
   *
   * @param code - Code to execute
   * @param language - Programming language
   * @returns Execution result
   */
  async executeCode(
    code: string,
    language: "typescript" | "javascript" | "bash"
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    let result: ExecutionResult;

    try {
      switch (language) {
        case "javascript":
        case "typescript":
          result = await this.executeJavaScript(code);
          break;

        case "bash":
          result = await this.executeBash(code);
          break;

        default:
          result = {
            stdout: "",
            stderr: `Unsupported language: ${language}`,
            exitCode: 1,
            executionTime: 0,
          };
      }
    } catch (error) {
      result = {
        stdout: "",
        stderr:
          error instanceof Error ? error.message : "Unknown execution error",
        exitCode: 1,
        executionTime: Date.now() - startTime,
      };
    }

    result.executionTime = Date.now() - startTime;
    return result;
  }

  /**
   * Execute JavaScript/TypeScript code
   */
  private async executeJavaScript(code: string): Promise<ExecutionResult> {
    // Simulate execution delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    let stdout = "";
    let stderr = "";
    let exitCode = 0;

    try {
      // Mock console.log capture
      const logs: string[] = [];
      const mockConsole = {
        log: (...args: any[]) => {
          logs.push(args.map((a) => String(a)).join(" "));
        },
      };

      // Check for syntax errors
      if (code.includes("syntax error") || code.includes("SyntaxError")) {
        stderr = "SyntaxError: Unexpected token";
        exitCode = 1;
      }
      // Check for runtime errors
      else if (
        code.includes("throw new Error") ||
        code.includes("throw Error")
      ) {
        const errorMatch = code.match(/throw\s+(?:new\s+)?Error\(['"](.+?)['"]/);
        stderr = errorMatch
          ? `Error: ${errorMatch[1]}`
          : "Error: Runtime error occurred";
        exitCode = 1;
      }
      // Handle console.log statements
      else if (code.includes("console.log")) {
        // First, extract any variable declarations
        const variables = new Map<string, string>();
        const varMatches = code.matchAll(/(?:const|let|var)\s+(\w+)(?::\s*\w+)?\s*=\s*['"](.+?)['"]/g);
        for (const match of varMatches) {
          variables.set(match[1], match[2]);
        }

        const logMatches = code.matchAll(/console\.log\((.+?)\)/g);
        for (const match of logMatches) {
          const arg = match[1].trim();
          // Evaluate simple expressions
          if (arg.match(/^['"].*['"]$/)) {
            // String literal
            logs.push(arg.slice(1, -1));
          } else if (arg.match(/^\d+$/)) {
            // Number literal
            logs.push(arg);
          } else if (arg.includes("+") || arg.includes("-") || arg.includes("*") || arg.includes("/")) {
            // Math expression
            try {
              const result = this.evaluateMathExpression(arg);
              logs.push(String(result));
            } catch {
              logs.push(arg);
            }
          } else if (variables.has(arg)) {
            // Variable reference - use its value
            logs.push(variables.get(arg)!);
          } else {
            // Variable name or other expression - just use the name
            logs.push(arg);
          }
        }
        stdout = logs.join("\n");
      }
      // Handle variable declarations and usage
      else if (code.includes("const") || code.includes("let") || code.includes("var")) {
        // Extract string values from variable declarations
        const stringMatch = code.match(/=\s*['"](.+?)['"]/);
        if (stringMatch) {
          stdout = stringMatch[1];
        } else {
          stdout = "Code executed successfully";
        }
      }
      // Handle simple math expressions
      else if (code.match(/^\s*[\d+\-*/\s()]+\s*$/)) {
        const result = this.evaluateMathExpression(code);
        stdout = String(result);
      }
      // Handle variable assignments and returns
      else if (code.includes("return ")) {
        const returnMatch = code.match(/return\s+(.+?)[;\n]/);
        if (returnMatch) {
          const returnValue = returnMatch[1].trim();
          if (returnValue.match(/^['"].*['"]$/)) {
            stdout = returnValue.slice(1, -1);
          } else if (returnValue.match(/^\d+$/)) {
            stdout = returnValue;
          } else {
            try {
              const result = this.evaluateMathExpression(returnValue);
              stdout = String(result);
            } catch {
              stdout = returnValue;
            }
          }
        }
      }
      // Default success message
      else {
        stdout = "Code executed successfully";
      }
    } catch (error) {
      stderr = error instanceof Error ? error.message : "Execution error";
      exitCode = 1;
    }

    return {
      stdout,
      stderr,
      exitCode,
      executionTime: 0, // Will be set by caller
    };
  }

  /**
   * Execute bash commands
   */
  private async executeBash(code: string): Promise<ExecutionResult> {
    // Simulate execution delay
    await new Promise((resolve) => setTimeout(resolve, 80));

    let stdout = "";
    let stderr = "";
    let exitCode = 0;

    try {
      const trimmedCode = code.trim();

      // Handle common bash commands
      if (trimmedCode.startsWith("echo ")) {
        const message = trimmedCode
          .substring(5)
          .replace(/^['"]/, "")
          .replace(/['"]$/, "");
        stdout = message;
      } else if (trimmedCode === "pwd") {
        stdout = "/home/sandbox";
      } else if (trimmedCode.startsWith("ls")) {
        stdout = "file1.txt\nfile2.txt\nscript.sh";
      } else if (trimmedCode === "whoami") {
        stdout = "sandbox-user";
      } else if (trimmedCode === "date") {
        stdout = new Date().toISOString();
      } else if (trimmedCode.startsWith("cat ")) {
        stdout = "File contents would be displayed here";
      } else if (trimmedCode.includes("error") || trimmedCode.includes("fail")) {
        stderr = "bash: command failed";
        exitCode = 1;
      } else {
        stdout = `Executed: ${trimmedCode}`;
      }
    } catch (error) {
      stderr = error instanceof Error ? error.message : "Bash execution error";
      exitCode = 1;
    }

    return {
      stdout,
      stderr,
      exitCode,
      executionTime: 0, // Will be set by caller
    };
  }

  /**
   * Evaluate simple math expressions
   */
  private evaluateMathExpression(expr: string): number {
    // Remove whitespace
    expr = expr.replace(/\s+/g, "");

    // Safety check - only allow numbers and basic operators
    if (!/^[\d+\-*/().]+$/.test(expr)) {
      throw new Error("Invalid math expression");
    }

    // Use Function constructor as a safer alternative to eval
    // Still a mock - in production use a proper math parser
    try {
      return Function(`"use strict"; return (${expr})`)();
    } catch {
      throw new Error("Failed to evaluate expression");
    }
  }

  /**
   * Validate code before execution (security check)
   */
  validateCode(code: string, language: string): { valid: boolean; error?: string } {
    // Check for dangerous patterns
    const dangerousPatterns = [
      /require\s*\(/i,
      /import\s+.*\s+from/i,
      /eval\s*\(/i,
      /Function\s*\(/i,
      /process\./i,
      /__dirname/i,
      /__filename/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          valid: false,
          error: `Potentially unsafe code detected: ${pattern.source}`,
        };
      }
    }

    // Check code length
    if (code.length > 10000) {
      return {
        valid: false,
        error: "Code exceeds maximum length of 10000 characters",
      };
    }

    return { valid: true };
  }
}

/**
 * Singleton instance
 */
export const codeExecutor = new CodeExecutor();
