/**
 * Tool Setup and Registration
 *
 * Centralized setup for all tools in the Agent Execution Engine.
 * Registers all available tools with the tool registry and creates
 * a configured dispatcher.
 */
import { ToolRegistry, toolRegistry } from "./tool-registry";
import { ToolDispatcher, createToolDispatcher } from "./tool-dispatcher";
import type { ToolDefinition } from "./tool-registry";

// Import tool implementations
import {
  WorkflowOrchestrator,
  WorkflowOrchestratorSchema,
} from "./tools/workflow-orchestrator";
import {
  GoogleSearchTool,
  GoogleSearchSchema,
} from "./tools/google-search";
import {
  CodeExecutor,
  CodeExecutorSchema,
} from "./tools/code-executor";
import {
  ParallelJobRunner,
  ParallelJobSchema,
} from "./tools/parallel-job";
import {
  RAGClient,
  RAGClientSchema,
} from "./tools/retrieve-context";

/**
 * Initialize all tools and register them
 */
export function setupTools(): {
  registry: ToolRegistry;
  dispatcher: ToolDispatcher;
} {
  // Create tool instances
  const workflowOrchestrator = new WorkflowOrchestrator();
  const googleSearch = new GoogleSearchTool();
  const codeExecutor = new CodeExecutor();
  const jobRunner = new ParallelJobRunner();
  const ragClient = new RAGClient();

  // Define tool definitions
  const tools: ToolDefinition[] = [
    {
      name: "workflow_orchestrator",
      description:
        "Executes complex pre-defined workflows such as data pipelines, API call chains, and notification workflows. Supports workflows: data-pipeline, api-call-chain, notification-workflow, etl-process, report-generation.",
      inputSchema: WorkflowOrchestratorSchema,
      execute: async (args) => {
        return await workflowOrchestrator.executeWorkflow(
          args.workflowName,
          args.params
        );
      },
    },
    {
      name: "google_search",
      description:
        "Performs real-time web searches to retrieve current information for grounding and RAG. Returns relevant search results with titles, URLs, snippets, and relevance scores.",
      inputSchema: GoogleSearchSchema,
      execute: async (args) => {
        return await googleSearch.search(args.query, args.limit);
      },
    },
    {
      name: "code_executor",
      description:
        "Executes code in a secure sandboxed environment. Supports JavaScript, TypeScript, and Bash. Returns stdout, stderr, exit code, and execution time. Validates code for security before execution.",
      inputSchema: CodeExecutorSchema,
      execute: async (args) => {
        // Validate code first
        const validation = codeExecutor.validateCode(args.code, args.language);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
        return await codeExecutor.executeCode(args.code, args.language);
      },
    },
    {
      name: "submit_parallel_job",
      description:
        "Submits long-running non-blocking jobs for parallel execution. Supports job types: data-processing, model-training, batch-inference, report-generation, data-export. Returns job ID for status checking.",
      inputSchema: ParallelJobSchema,
      execute: async (args) => {
        return await jobRunner.submitJob(args.jobSpec);
      },
    },
    {
      name: "retrieve_context",
      description:
        "Retrieves relevant context chunks from internal knowledge base for RAG. Searches across programming concepts, API documentation, system architecture, best practices, security, and performance topics. Returns scored and ranked results.",
      inputSchema: RAGClientSchema,
      execute: async (args) => {
        return await ragClient.retrieveContext(args.query, args.limit);
      },
    },
  ];

  // Clear existing tools (for testing/reinitialization)
  toolRegistry.clear();

  // Register all tools
  tools.forEach((tool) => {
    toolRegistry.register(tool);
  });

  // Create dispatcher
  const dispatcher = createToolDispatcher(toolRegistry);

  return {
    registry: toolRegistry,
    dispatcher,
  };
}

/**
 * Get singleton instances of configured tools
 */
export function getConfiguredTools(): {
  registry: ToolRegistry;
  dispatcher: ToolDispatcher;
} {
  // Check if tools are already registered
  if (toolRegistry.count() === 0) {
    return setupTools();
  }

  return {
    registry: toolRegistry,
    dispatcher: createToolDispatcher(toolRegistry),
  };
}

/**
 * List all available tools with their descriptions
 */
export function listAvailableTools(): Array<{
  name: string;
  description: string;
}> {
  const { registry } = getConfiguredTools();
  const toolNames = registry.list();

  return toolNames.map((name) => {
    const tool = registry.get(name);
    return {
      name,
      description: tool?.description || "",
    };
  });
}

// Auto-setup on import (can be disabled if needed)
if (toolRegistry.count() === 0) {
  setupTools();
}
