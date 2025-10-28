/**
 * Tests for LLMPrompts
 */

import { describe, it, expect } from "vitest";
import { LLMPrompts } from "./llm-prompts";
import { ToolName } from "./types";

describe("LLMPrompts", () => {
  describe("getSystemPrompt", () => {
    it("should return a system prompt", () => {
      const prompt = LLMPrompts.getSystemPrompt();

      expect(prompt).toBeTruthy();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(100);
    });

    it("should define agent role", () => {
      const prompt = LLMPrompts.getSystemPrompt();

      expect(prompt).toContain("autonomous AI agent");
      expect(prompt).toContain("FlashFusion");
      expect(prompt).toContain("Cortex-Nexus");
    });

    it("should list all available actions", () => {
      const prompt = LLMPrompts.getSystemPrompt();

      expect(prompt).toContain("LLM_CALL");
      expect(prompt).toContain("TOOL_CALL");
      expect(prompt).toContain("FINAL_ANSWER");
    });

    it("should specify JSON response format", () => {
      const prompt = LLMPrompts.getSystemPrompt();

      expect(prompt).toContain("JSON");
      expect(prompt).toContain("actionType");
      expect(prompt).toContain("reasoning");
    });

    it("should include response format fields", () => {
      const prompt = LLMPrompts.getSystemPrompt();

      expect(prompt).toContain("nextPrompt");
      expect(prompt).toContain("toolName");
      expect(prompt).toContain("toolArguments");
      expect(prompt).toContain("finalAnswer");
    });

    it("should provide reasoning guidelines", () => {
      const prompt = LLMPrompts.getSystemPrompt();

      expect(prompt).toContain("chain-of-thought");
      expect(prompt.toLowerCase()).toContain("reasoning");
    });
  });

  describe("getChainOfThoughtPrompt", () => {
    it("should include the provided context", () => {
      const context = "User wants to calculate 2+2";
      const prompt = LLMPrompts.getChainOfThoughtPrompt(context);

      expect(prompt).toContain(context);
    });

    it("should prompt for step-by-step reasoning", () => {
      const context = "Test context";
      const prompt = LLMPrompts.getChainOfThoughtPrompt(context);

      expect(prompt.toLowerCase()).toContain("step-by-step");
      expect(prompt).toContain("chain-of-thought");
    });

    it("should include reasoning questions", () => {
      const context = "Test context";
      const prompt = LLMPrompts.getChainOfThoughtPrompt(context);

      expect(prompt).toContain("What information do I have?");
      expect(prompt).toContain("What information do I need?");
      expect(prompt).toContain("What should I do next?");
      expect(prompt).toContain("What action should I take?");
    });

    it("should reference JSON format", () => {
      const context = "Test context";
      const prompt = LLMPrompts.getChainOfThoughtPrompt(context);

      expect(prompt).toContain("JSON");
    });
  });

  describe("getToolSelectionPrompt", () => {
    it("should list provided tools", () => {
      const tools: ToolName[] = ["google_search", "code_executor"];
      const prompt = LLMPrompts.getToolSelectionPrompt(tools);

      expect(prompt).toContain("google_search");
      expect(prompt).toContain("code_executor");
    });

    it("should include tool descriptions", () => {
      const tools: ToolName[] = ["google_search"];
      const prompt = LLMPrompts.getToolSelectionPrompt(tools);

      expect(prompt).toContain("Real-time web search");
    });

    it("should handle all tool types", () => {
      const tools: ToolName[] = [
        "workflow_orchestrator",
        "google_search",
        "code_executor",
        "submit_parallel_job",
        "retrieve_context",
      ];
      const prompt = LLMPrompts.getToolSelectionPrompt(tools);

      expect(prompt).toContain("workflow_orchestrator");
      expect(prompt).toContain("google_search");
      expect(prompt).toContain("code_executor");
      expect(prompt).toContain("submit_parallel_job");
      expect(prompt).toContain("retrieve_context");
    });

    it("should provide tool selection guidance", () => {
      const tools: ToolName[] = ["google_search"];
      const prompt = LLMPrompts.getToolSelectionPrompt(tools);

      expect(prompt.toLowerCase()).toContain("select");
      expect(prompt.toLowerCase()).toContain("appropriate");
    });

    it("should prompt for consideration of tool capabilities", () => {
      const tools: ToolName[] = ["google_search"];
      const prompt = LLMPrompts.getToolSelectionPrompt(tools);

      expect(prompt).toContain("Consider:");
      expect(prompt.toLowerCase()).toContain("capability");
      expect(prompt.toLowerCase()).toContain("information");
    });
  });

  describe("getFinalAnswerPrompt", () => {
    it("should prompt for final answer", () => {
      const prompt = LLMPrompts.getFinalAnswerPrompt();

      expect(prompt.toLowerCase()).toContain("final answer");
    });

    it("should specify requirements for the answer", () => {
      const prompt = LLMPrompts.getFinalAnswerPrompt();

      expect(prompt).toContain("Requirements:");
      expect(prompt.toLowerCase()).toContain("clear");
      expect(prompt.toLowerCase()).toContain("concise");
      expect(prompt.toLowerCase()).toContain("complete");
    });

    it("should mention addressing all aspects", () => {
      const prompt = LLMPrompts.getFinalAnswerPrompt();

      expect(prompt.toLowerCase()).toContain("all aspects");
    });

    it("should reference FINAL_ANSWER action type", () => {
      const prompt = LLMPrompts.getFinalAnswerPrompt();

      expect(prompt).toContain("FINAL_ANSWER");
    });

    it("should mention accuracy and sources", () => {
      const prompt = LLMPrompts.getFinalAnswerPrompt();

      expect(prompt.toLowerCase()).toContain("factual");
      expect(prompt.toLowerCase()).toContain("accurate");
      expect(prompt.toLowerCase()).toContain("sources");
    });
  });

  describe("getToolResultPrompt", () => {
    it("should include tool name", () => {
      const toolName: ToolName = "google_search";
      const result = { results: ["result1", "result2"] };
      const prompt = LLMPrompts.getToolResultPrompt(toolName, result);

      expect(prompt).toContain("google_search");
    });

    it("should include formatted tool result", () => {
      const toolName: ToolName = "code_executor";
      const result = { output: "Hello, World!", exitCode: 0 };
      const prompt = LLMPrompts.getToolResultPrompt(toolName, result);

      expect(prompt).toContain("Hello, World!");
      expect(prompt).toContain("0");
    });

    it("should format result as JSON", () => {
      const toolName: ToolName = "google_search";
      const result = { query: "test", results: [] };
      const prompt = LLMPrompts.getToolResultPrompt(toolName, result);

      expect(prompt).toContain('"query"');
      expect(prompt).toContain('"results"');
    });

    it("should prompt for next action decision", () => {
      const toolName: ToolName = "google_search";
      const result = { results: [] };
      const prompt = LLMPrompts.getToolResultPrompt(toolName, result);

      expect(prompt.toLowerCase()).toContain("decide");
      expect(prompt.toLowerCase()).toContain("next");
    });

    it("should list possible next actions", () => {
      const toolName: ToolName = "google_search";
      const result = { results: [] };
      const prompt = LLMPrompts.getToolResultPrompt(toolName, result);

      expect(prompt.toLowerCase()).toContain("call another tool");
      expect(prompt.toLowerCase()).toContain("more reasoning");
      expect(prompt.toLowerCase()).toContain("final answer");
    });
  });

  describe("getErrorHandlingPrompt", () => {
    it("should include error message", () => {
      const errorMessage = "Failed to connect to API";
      const prompt = LLMPrompts.getErrorHandlingPrompt(errorMessage);

      expect(prompt).toContain(errorMessage);
    });

    it("should prompt for error handling considerations", () => {
      const errorMessage = "Test error";
      const prompt = LLMPrompts.getErrorHandlingPrompt(errorMessage);

      expect(prompt).toContain("Consider:");
      expect(prompt.toLowerCase()).toContain("work around");
      expect(prompt.toLowerCase()).toContain("different approach");
    });

    it("should suggest providing partial answer", () => {
      const errorMessage = "Test error";
      const prompt = LLMPrompts.getErrorHandlingPrompt(errorMessage);

      expect(prompt.toLowerCase()).toContain("partial answer");
      expect(prompt.toLowerCase()).toContain("limitations");
    });

    it("should prompt for decision on how to proceed", () => {
      const errorMessage = "Test error";
      const prompt = LLMPrompts.getErrorHandlingPrompt(errorMessage);

      expect(prompt.toLowerCase()).toContain("proceed");
      expect(prompt.toLowerCase()).toContain("decision");
    });
  });

  describe("getDepthCheckPrompt", () => {
    it("should include current and max depth", () => {
      const prompt = LLMPrompts.getDepthCheckPrompt(3, 5);

      expect(prompt).toContain("3");
      expect(prompt).toContain("5");
    });

    it("should warn about approaching limit", () => {
      const prompt = LLMPrompts.getDepthCheckPrompt(4, 5);

      expect(prompt.toLowerCase()).toContain("depth");
      expect(prompt).toContain("4");
      expect(prompt).toContain("5");
    });

    it("should prompt for efficiency considerations", () => {
      const prompt = LLMPrompts.getDepthCheckPrompt(3, 5);

      expect(prompt).toContain("Consider:");
      expect(prompt.toLowerCase()).toContain("progress");
      expect(prompt.toLowerCase()).toContain("final answer");
    });

    it("should mention balancing thoroughness and efficiency", () => {
      const prompt = LLMPrompts.getDepthCheckPrompt(3, 5);

      expect(prompt.toLowerCase()).toContain("thoroughness");
      expect(prompt.toLowerCase()).toContain("efficiency");
    });

    it("should ask about minimum information needed", () => {
      const prompt = LLMPrompts.getDepthCheckPrompt(4, 5);

      expect(prompt.toLowerCase()).toContain("minimum");
      expect(prompt.toLowerCase()).toContain("information needed");
    });
  });

  describe("prompt consistency", () => {
    it("should reference system prompt format in all prompts", () => {
      const prompts = [
        LLMPrompts.getChainOfThoughtPrompt("test"),
        LLMPrompts.getToolSelectionPrompt(["google_search"]),
        LLMPrompts.getFinalAnswerPrompt(),
        LLMPrompts.getToolResultPrompt("google_search", {}),
        LLMPrompts.getErrorHandlingPrompt("error"),
      ];

      prompts.forEach((prompt) => {
        expect(prompt.toLowerCase()).toContain("json");
      });
    });

    it("should maintain consistent tone across prompts", () => {
      const prompts = [
        LLMPrompts.getSystemPrompt(),
        LLMPrompts.getChainOfThoughtPrompt("test"),
        LLMPrompts.getToolSelectionPrompt(["google_search"]),
        LLMPrompts.getFinalAnswerPrompt(),
      ];

      prompts.forEach((prompt) => {
        expect(prompt.length).toBeGreaterThan(50); // All substantial
        expect(prompt).not.toContain("😀"); // No emojis
        expect(prompt).not.toContain("!!!"); // No excessive punctuation
      });
    });
  });

  describe("prompt completeness", () => {
    it("should provide all necessary context in each prompt", () => {
      const systemPrompt = LLMPrompts.getSystemPrompt();
      const chainOfThought = LLMPrompts.getChainOfThoughtPrompt("test");
      const toolSelection = LLMPrompts.getToolSelectionPrompt(["google_search"]);

      // System prompt should be comprehensive
      expect(systemPrompt.split("\n").length).toBeGreaterThan(5);

      // Chain of thought should guide reasoning
      expect(chainOfThought).toContain("?"); // Has questions

      // Tool selection should list tools
      expect(toolSelection).toContain(":"); // Has descriptions
    });
  });
});
