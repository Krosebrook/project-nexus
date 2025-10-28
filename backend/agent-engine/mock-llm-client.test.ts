/**
 * Tests for MockLLMClient
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MockLLMClient } from "./mock-llm-client";
import { LLMConfig } from "./llm-client";

describe("MockLLMClient", () => {
  let client: MockLLMClient;

  beforeEach(() => {
    client = new MockLLMClient();
  });

  describe("call", () => {
    it("should return default response when no custom responses are set", async () => {
      const response = await client.call("Test prompt");

      expect(response.content).toBe("Mock LLM response");
      expect(response.finishReason).toBe("stop");
      expect(response.model).toBe("mock-model");
    });

    it("should return custom response for exact match", async () => {
      client.setResponse("Test prompt", "Custom response");

      const response = await client.call("Test prompt");

      expect(response.content).toBe("Custom response");
    });

    it("should return custom response for substring match", async () => {
      client.setResponse("special keyword", "Special response");

      const response = await client.call("This prompt contains special keyword in it");

      expect(response.content).toBe("Special response");
    });

    it("should prioritize exact match over substring match", async () => {
      client.setResponse("test", "Substring match");
      client.setResponse("test prompt", "Exact match");

      const response = await client.call("test prompt");

      expect(response.content).toBe("Exact match");
    });

    it("should use custom model from config", async () => {
      const config: LLMConfig = { model: "gpt-4" };
      const response = await client.call("Test prompt", config);

      expect(response.model).toBe("gpt-4");
    });

    it("should calculate tokens correctly", async () => {
      const prompt = "1234567890"; // 10 chars = 3 tokens (rounded up)
      client.setResponse(prompt, "12345678"); // 8 chars = 2 tokens

      const response = await client.call(prompt);

      expect(response.tokensUsed).toBe(5); // 3 + 2
    });

    it("should support delay configuration", async () => {
      client.setDelay(100);

      const startTime = Date.now();
      await client.call("Test prompt");
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it("should throw configured error", async () => {
      const testError = new Error("Test error");
      client.setError(testError);

      await expect(client.call("Test prompt")).rejects.toThrow("Test error");
    });

    it("should reset error after throwing once", async () => {
      const testError = new Error("Test error");
      client.setError(testError);

      await expect(client.call("Test prompt")).rejects.toThrow("Test error");

      // Second call should succeed
      const response = await client.call("Test prompt");
      expect(response.content).toBe("Mock LLM response");
    });

    it("should support constructor initialization with responses", async () => {
      const responses = new Map([
        ["prompt1", "response1"],
        ["prompt2", "response2"],
      ]);
      const initializedClient = new MockLLMClient(responses);

      const response1 = await initializedClient.call("prompt1");
      const response2 = await initializedClient.call("prompt2");

      expect(response1.content).toBe("response1");
      expect(response2.content).toBe("response2");
    });
  });

  describe("countTokens", () => {
    it("should count tokens as chars / 4, rounded up", () => {
      expect(client.countTokens("1234")).toBe(1); // 4 / 4 = 1
      expect(client.countTokens("12345")).toBe(2); // 5 / 4 = 1.25, rounded up to 2
      expect(client.countTokens("123456789")).toBe(3); // 9 / 4 = 2.25, rounded up to 3
      expect(client.countTokens("1234567890123456")).toBe(4); // 16 / 4 = 4
    });

    it("should handle empty string", () => {
      expect(client.countTokens("")).toBe(0);
    });

    it("should handle unicode characters", () => {
      expect(client.countTokens("🚀🚀🚀🚀")).toBe(2); // Each emoji is 2 chars, so 8 / 4 = 2
    });
  });

  describe("reset", () => {
    it("should reset all state", async () => {
      client.setResponse("test", "custom");
      client.setDelay(100);

      client.reset();

      const startTime = Date.now();
      const response = await client.call("test");
      const endTime = Date.now();

      expect(response.content).toBe("Mock LLM response");
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe("setResponse", () => {
    it("should allow updating responses", async () => {
      client.setResponse("test", "first");
      const response1 = await client.call("test");
      expect(response1.content).toBe("first");

      client.setResponse("test", "second");
      const response2 = await client.call("test");
      expect(response2.content).toBe("second");
    });
  });

  describe("determinism", () => {
    it("should return identical responses for identical prompts", async () => {
      client.setResponse("deterministic", "same every time");

      const response1 = await client.call("deterministic");
      const response2 = await client.call("deterministic");
      const response3 = await client.call("deterministic");

      expect(response1.content).toBe(response2.content);
      expect(response2.content).toBe(response3.content);
      expect(response1.tokensUsed).toBe(response2.tokensUsed);
      expect(response2.tokensUsed).toBe(response3.tokensUsed);
    });
  });
});
