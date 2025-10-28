/**
 * Tool Registry Tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "./tool-registry";
import type { ToolDefinition } from "./tool-registry";
import type { ToolName } from "./types";

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe("register", () => {
    it("should register a new tool", () => {
      const tool: ToolDefinition = {
        name: "google_search" as ToolName,
        description: "Search the web",
        inputSchema: z.object({ query: z.string() }),
        execute: async (args) => ({ results: [] }),
      };

      registry.register(tool);
      expect(registry.count()).toBe(1);
      expect(registry.get("google_search")).toBeDefined();
    });

    it("should throw error when registering duplicate tool", () => {
      const tool: ToolDefinition = {
        name: "google_search" as ToolName,
        description: "Search the web",
        inputSchema: z.object({ query: z.string() }),
        execute: async (args) => ({ results: [] }),
      };

      registry.register(tool);
      expect(() => registry.register(tool)).toThrow(
        "Tool google_search is already registered"
      );
    });

    it("should register multiple different tools", () => {
      const tool1: ToolDefinition = {
        name: "google_search" as ToolName,
        description: "Search the web",
        inputSchema: z.object({ query: z.string() }),
        execute: async (args) => ({ results: [] }),
      };

      const tool2: ToolDefinition = {
        name: "code_executor" as ToolName,
        description: "Execute code",
        inputSchema: z.object({ code: z.string() }),
        execute: async (args) => ({ output: "" }),
      };

      registry.register(tool1);
      registry.register(tool2);

      expect(registry.count()).toBe(2);
    });
  });

  describe("get", () => {
    it("should retrieve registered tool", () => {
      const tool: ToolDefinition = {
        name: "google_search" as ToolName,
        description: "Search the web",
        inputSchema: z.object({ query: z.string() }),
        execute: async (args) => ({ results: [] }),
      };

      registry.register(tool);
      const retrieved = registry.get("google_search");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("google_search");
      expect(retrieved?.description).toBe("Search the web");
    });

    it("should return undefined for non-existent tool", () => {
      const tool = registry.get("google_search");
      expect(tool).toBeUndefined();
    });
  });

  describe("list", () => {
    it("should return empty array when no tools registered", () => {
      expect(registry.list()).toEqual([]);
    });

    it("should return all registered tool names", () => {
      const tools: ToolDefinition[] = [
        {
          name: "google_search" as ToolName,
          description: "Search",
          inputSchema: z.object({ query: z.string() }),
          execute: async () => ({}),
        },
        {
          name: "code_executor" as ToolName,
          description: "Execute",
          inputSchema: z.object({ code: z.string() }),
          execute: async () => ({}),
        },
      ];

      tools.forEach((tool) => registry.register(tool));
      const names = registry.list();

      expect(names).toHaveLength(2);
      expect(names).toContain("google_search");
      expect(names).toContain("code_executor");
    });
  });

  describe("validate", () => {
    beforeEach(() => {
      const tool: ToolDefinition = {
        name: "google_search" as ToolName,
        description: "Search the web",
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().optional(),
        }),
        execute: async (args) => ({ results: [] }),
      };

      registry.register(tool);
    });

    it("should validate correct arguments", () => {
      const isValid = registry.validate("google_search", {
        query: "test query",
      });
      expect(isValid).toBe(true);
    });

    it("should validate with optional parameters", () => {
      const isValid = registry.validate("google_search", {
        query: "test query",
        limit: 10,
      });
      expect(isValid).toBe(true);
    });

    it("should reject invalid arguments", () => {
      const isValid = registry.validate("google_search", {
        limit: 10, // missing required 'query'
      });
      expect(isValid).toBe(false);
    });

    it("should reject wrong type arguments", () => {
      const isValid = registry.validate("google_search", {
        query: 123, // should be string
      });
      expect(isValid).toBe(false);
    });

    it("should return false for non-existent tool", () => {
      const isValid = registry.validate("non_existent" as ToolName, {});
      expect(isValid).toBe(false);
    });
  });

  describe("getValidationErrors", () => {
    beforeEach(() => {
      const tool: ToolDefinition = {
        name: "code_executor" as ToolName,
        description: "Execute code",
        inputSchema: z.object({
          code: z.string(),
          language: z.enum(["typescript", "javascript", "bash"]),
        }),
        execute: async (args) => ({ output: "" }),
      };

      registry.register(tool);
    });

    it("should return null for valid arguments", () => {
      const errors = registry.getValidationErrors("code_executor", {
        code: "console.log('test')",
        language: "javascript",
      });
      expect(errors).toBeNull();
    });

    it("should return ZodError for invalid arguments", () => {
      const errors = registry.getValidationErrors("code_executor", {
        code: "test",
        language: "python", // invalid enum value
      });
      expect(errors).not.toBeNull();
      expect(errors?.issues).toBeDefined();
    });

    it("should return null for non-existent tool", () => {
      const errors = registry.getValidationErrors("non_existent" as ToolName, {});
      expect(errors).toBeNull();
    });
  });

  describe("unregister", () => {
    it("should remove a registered tool", () => {
      const tool: ToolDefinition = {
        name: "google_search" as ToolName,
        description: "Search",
        inputSchema: z.object({ query: z.string() }),
        execute: async () => ({}),
      };

      registry.register(tool);
      expect(registry.count()).toBe(1);

      registry.unregister("google_search");
      expect(registry.count()).toBe(0);
      expect(registry.get("google_search")).toBeUndefined();
    });

    it("should handle unregistering non-existent tool", () => {
      expect(() => registry.unregister("google_search")).not.toThrow();
    });
  });

  describe("clear", () => {
    it("should remove all tools", () => {
      const tools: ToolDefinition[] = [
        {
          name: "google_search" as ToolName,
          description: "Search",
          inputSchema: z.object({ query: z.string() }),
          execute: async () => ({}),
        },
        {
          name: "code_executor" as ToolName,
          description: "Execute",
          inputSchema: z.object({ code: z.string() }),
          execute: async () => ({}),
        },
      ];

      tools.forEach((tool) => registry.register(tool));
      expect(registry.count()).toBe(2);

      registry.clear();
      expect(registry.count()).toBe(0);
      expect(registry.list()).toEqual([]);
    });
  });

  describe("count", () => {
    it("should return 0 for empty registry", () => {
      expect(registry.count()).toBe(0);
    });

    it("should return correct count after registrations", () => {
      const tool: ToolDefinition = {
        name: "google_search" as ToolName,
        description: "Search",
        inputSchema: z.object({ query: z.string() }),
        execute: async () => ({}),
      };

      registry.register(tool);
      expect(registry.count()).toBe(1);
    });
  });
});
