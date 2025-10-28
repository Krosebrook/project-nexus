/**
 * Tool Registry
 *
 * Central registry for all available tools in the Agent Execution Engine.
 * Manages registration, validation, and lookup of tool definitions.
 */
import { z } from "zod";
import type { ToolName } from "./types";

/**
 * Tool definition interface
 */
export interface ToolDefinition {
  name: ToolName;
  description: string;
  inputSchema: z.ZodSchema;
  execute: (args: any) => Promise<any>;
}

/**
 * ToolRegistry - manages all available tools
 */
export class ToolRegistry {
  private tools = new Map<ToolName, ToolDefinition>();

  /**
   * Register a new tool
   *
   * @param tool - Tool definition to register
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   *
   * @param name - Tool name
   * @returns Tool definition or undefined if not found
   */
  get(name: ToolName): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tool names
   *
   * @returns Array of tool names
   */
  list(): ToolName[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Validate tool arguments against schema
   *
   * @param name - Tool name
   * @param args - Arguments to validate
   * @returns True if valid, false otherwise
   */
  validate(name: ToolName, args: any): boolean {
    const tool = this.tools.get(name);
    if (!tool) {
      return false;
    }

    try {
      tool.inputSchema.parse(args);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get validation errors for tool arguments
   *
   * @param name - Tool name
   * @param args - Arguments to validate
   * @returns Validation errors or null if valid
   */
  getValidationErrors(name: ToolName, args: any): z.ZodError | null {
    const tool = this.tools.get(name);
    if (!tool) {
      return null;
    }

    try {
      tool.inputSchema.parse(args);
      return null;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error;
      }
      return null;
    }
  }

  /**
   * Unregister a tool (for testing)
   *
   * @param name - Tool name
   */
  unregister(name: ToolName): void {
    this.tools.delete(name);
  }

  /**
   * Clear all tools (for testing)
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get count of registered tools
   */
  count(): number {
    return this.tools.size;
  }
}

/**
 * Singleton instance
 */
export const toolRegistry = new ToolRegistry();
