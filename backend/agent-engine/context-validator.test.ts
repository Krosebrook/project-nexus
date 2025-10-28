/**
 * Unit tests for ContextWindowValidator
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  ContextWindowValidator,
  CONTEXT_CONFIG,
} from "./context-validator";

describe("ContextWindowValidator", () => {
  let validator: ContextWindowValidator;

  beforeEach(() => {
    validator = new ContextWindowValidator();
  });

  describe("estimateTokens", () => {
    it("should estimate tokens for simple text", () => {
      const text = "Hello, world!"; // 13 chars
      const tokens = validator.estimateTokens(text);

      // 13 / 4 = 3.25 -> 4 tokens
      expect(tokens).toBe(Math.ceil(13 / CONTEXT_CONFIG.CHARS_PER_TOKEN));
    });

    it("should return 0 for empty string", () => {
      expect(validator.estimateTokens("")).toBe(0);
    });

    it("should handle large text", () => {
      const text = "a".repeat(10000); // 10000 chars
      const tokens = validator.estimateTokens(text);

      // 10000 / 4 = 2500 tokens
      expect(tokens).toBe(2500);
    });

    it("should round up for fractional results", () => {
      const text = "abc"; // 3 chars
      const tokens = validator.estimateTokens(text);

      // 3 / 4 = 0.75 -> 1 token
      expect(tokens).toBe(1);
    });

    it("should handle unicode characters", () => {
      const text = "Hello 世界"; // 8 chars (unicode counted as single chars)
      const tokens = validator.estimateTokens(text);

      expect(tokens).toBe(Math.ceil(text.length / CONTEXT_CONFIG.CHARS_PER_TOKEN));
    });

    it("should handle multiline text", () => {
      const text = "Line 1\nLine 2\nLine 3";
      const tokens = validator.estimateTokens(text);

      expect(tokens).toBe(Math.ceil(text.length / CONTEXT_CONFIG.CHARS_PER_TOKEN));
    });
  });

  describe("validateContextWindow", () => {
    it("should pass validation when within limit", () => {
      const prompt = "a".repeat(100); // 100 chars = ~25 tokens
      const limit = 1000;

      const result = validator.validateContextWindow(prompt, limit);

      expect(result.valid).toBe(true);
      expect(result.estimated).toBe(25);
      expect(result.limit).toBe(limit);
      expect(result.message).toBeUndefined();
    });

    it("should fail validation when exceeding limit", () => {
      const prompt = "a".repeat(1000); // 1000 chars = 250 tokens
      const limit = 100; // Limit is 100 tokens

      const result = validator.validateContextWindow(prompt, limit);

      expect(result.valid).toBe(false);
      expect(result.estimated).toBe(250);
      expect(result.limit).toBe(limit);
      expect(result.message).toContain("Context window exceeded");
    });

    it("should apply safety margin to limit", () => {
      // Safety margin is 0.9, so effective limit = 100 * 0.9 = 90
      const prompt = "a".repeat(380); // 380 chars = 95 tokens
      const limit = 100;

      const result = validator.validateContextWindow(prompt, limit);

      // 95 > 90 (effective limit), so should fail
      expect(result.valid).toBe(false);
    });

    it("should handle edge case at exact limit", () => {
      // Effective limit = 1000 * 0.9 = 900
      const prompt = "a".repeat(3600); // 3600 chars = 900 tokens
      const limit = 1000;

      const result = validator.validateContextWindow(prompt, limit);

      // Exactly at effective limit, should pass
      expect(result.valid).toBe(true);
    });

    it("should handle empty prompt", () => {
      const result = validator.validateContextWindow("", 1000);

      expect(result.valid).toBe(true);
      expect(result.estimated).toBe(0);
    });

    it("should include detailed error message", () => {
      const prompt = "a".repeat(10000);
      const limit = 1000;

      const result = validator.validateContextWindow(prompt, limit);

      expect(result.message).toContain("2500 tokens");
      expect(result.message).toContain("1000 limit");
    });
  });

  describe("validateMultipleTexts", () => {
    it("should combine multiple texts for validation", () => {
      const texts = ["Hello", "World", "Test"];
      const limit = 1000;

      const result = validator.validateMultipleTexts(texts, limit);

      // Combined: "Hello\n\nWorld\n\nTest" = 21 chars = 6 tokens
      expect(result.valid).toBe(true);
      expect(result.estimated).toBeGreaterThan(0);
    });

    it("should fail when combined texts exceed limit", () => {
      const texts = ["a".repeat(1000), "b".repeat(1000)];
      const limit = 100;

      const result = validator.validateMultipleTexts(texts, limit);

      expect(result.valid).toBe(false);
    });

    it("should handle empty array", () => {
      const result = validator.validateMultipleTexts([], 1000);

      expect(result.valid).toBe(true);
      expect(result.estimated).toBeGreaterThanOrEqual(0);
    });

    it("should handle single text", () => {
      const texts = ["Hello world"];
      const limit = 1000;

      const result = validator.validateMultipleTexts(texts, limit);

      expect(result.valid).toBe(true);
    });

    it("should add separators between texts", () => {
      const texts = ["A", "B", "C"];
      const result = validator.validateMultipleTexts(texts, 1000);

      // Should include \n\n separators
      expect(result.estimated).toBeGreaterThan(1);
    });
  });

  describe("getRemainingTokens", () => {
    it("should calculate remaining tokens correctly", () => {
      const text = "a".repeat(100); // 25 tokens
      const limit = 1000;

      const remaining = validator.getRemainingTokens(text, limit);

      expect(remaining).toBe(975); // 1000 - 25
    });

    it("should return 0 if already at limit", () => {
      const text = "a".repeat(4000); // 1000 tokens
      const limit = 1000;

      const remaining = validator.getRemainingTokens(text, limit);

      expect(remaining).toBe(0);
    });

    it("should return 0 if exceeding limit", () => {
      const text = "a".repeat(5000); // 1250 tokens
      const limit = 1000;

      const remaining = validator.getRemainingTokens(text, limit);

      expect(remaining).toBe(0);
    });

    it("should handle empty text", () => {
      const remaining = validator.getRemainingTokens("", 1000);

      expect(remaining).toBe(1000);
    });

    it("should handle large limits", () => {
      const text = "a".repeat(1000); // 250 tokens
      const limit = 128000;

      const remaining = validator.getRemainingTokens(text, limit);

      expect(remaining).toBe(127750);
    });
  });

  describe("canAddText", () => {
    it("should allow adding text within limit", () => {
      const currentText = "a".repeat(100); // 25 tokens
      const newText = "b".repeat(100); // 25 tokens
      const limit = 1000;

      const canAdd = validator.canAddText(currentText, newText, limit);

      expect(canAdd).toBe(true);
    });

    it("should reject adding text that would exceed limit", () => {
      const currentText = "a".repeat(3600); // 900 tokens
      const newText = "b".repeat(400); // 100 tokens
      const limit = 1000; // Effective limit = 900

      const canAdd = validator.canAddText(currentText, newText, limit);

      // 900 + 100 = 1000 > 900 (effective limit)
      expect(canAdd).toBe(false);
    });

    it("should apply safety margin to limit", () => {
      const currentText = "a".repeat(3200); // 800 tokens
      const newText = "b".repeat(400); // 100 tokens
      const limit = 1000; // Effective limit = 900

      const canAdd = validator.canAddText(currentText, newText, limit);

      // 800 + 100 = 900 <= 900 (effective limit)
      expect(canAdd).toBe(true);
    });

    it("should handle empty current text", () => {
      const newText = "a".repeat(100);
      const limit = 1000;

      const canAdd = validator.canAddText("", newText, limit);

      expect(canAdd).toBe(true);
    });

    it("should handle empty new text", () => {
      const currentText = "a".repeat(100);
      const limit = 1000;

      const canAdd = validator.canAddText(currentText, "", limit);

      expect(canAdd).toBe(true);
    });

    it("should handle both texts empty", () => {
      const canAdd = validator.canAddText("", "", 1000);

      expect(canAdd).toBe(true);
    });

    it("should handle edge case at exact effective limit", () => {
      const currentText = "a".repeat(1800); // 450 tokens
      const newText = "b".repeat(1800); // 450 tokens
      const limit = 1000; // Effective limit = 900

      const canAdd = validator.canAddText(currentText, newText, limit);

      // 450 + 450 = 900 <= 900
      expect(canAdd).toBe(true);
    });
  });

  describe("CONTEXT_CONFIG", () => {
    it("should have correct configuration values", () => {
      expect(CONTEXT_CONFIG.CHARS_PER_TOKEN).toBe(4);
      expect(CONTEXT_CONFIG.SAFETY_MARGIN).toBe(0.9);
    });

    it("should have safety margin less than 1", () => {
      expect(CONTEXT_CONFIG.SAFETY_MARGIN).toBeLessThan(1);
      expect(CONTEXT_CONFIG.SAFETY_MARGIN).toBeGreaterThan(0);
    });
  });
});
