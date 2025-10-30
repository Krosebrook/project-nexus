/**
 * Idempotency mechanism with Intent Signature calculation
 *
 * The Intent Signature is a SHA256 hash of stable job parameters,
 * excluding volatile parameters like correlationId and currentDepth.
 *
 * This ensures that identical requests (same user, prompt, and constraints)
 * can be deduplicated via cache lookup.
 */
import { createHash } from "crypto";
import type { AguiRunJob } from "./types";

/**
 * Parameters used for intent signature calculation
 * These are the stable parameters that define the "intent" of the job
 */
interface StableJobParameters {
  userId: string;
  prompt: string;
  maxDepth: number;
  contextWindowLimit: number;
  previousContext?: string;
  toolResults?: any[];
  metadata?: Record<string, any>;
}

/**
 * Extract stable parameters from the full job payload
 * Excludes volatile fields: correlationId, currentDepth
 *
 * @param job - The complete job payload
 * @returns Stable parameters for signature calculation
 */
export function extractStableParameters(job: AguiRunJob): StableJobParameters {
  return {
    userId: job.userId,
    prompt: job.prompt,
    maxDepth: job.maxDepth ?? 5,
    contextWindowLimit: job.contextWindowLimit ?? 8000,
    previousContext: job.previousContext,
    toolResults: job.toolResults,
    metadata: job.metadata
  };
}

/**
 * Normalize an object for consistent hashing
 * Sorts keys, handles undefined values, and creates deterministic JSON
 *
 * @param obj - Object to normalize
 * @returns Normalized JSON string
 */
function normalizeObject(obj: any): string {
  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(normalizeObject).join(',') + ']';
  }

  // Sort keys for deterministic output
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(key => {
    const value = obj[key];
    // Skip undefined values
    if (value === undefined) {
      return null;
    }
    return `"${key}":${normalizeObject(value)}`;
  }).filter(Boolean);

  return '{' + pairs.join(',') + '}';
}

/**
 * Calculate the Intent Signature (SHA256 hash) for a job
 *
 * The signature is calculated from stable parameters only, ensuring
 * that requests with the same intent produce the same signature
 * regardless of volatile parameters.
 *
 * @param job - The job payload
 * @returns SHA256 hash as hex string (64 characters)
 *
 * @example
 * const job = { userId: "user1", prompt: "Hello", correlationId: "123", ... };
 * const signature = calculateIntentSignature(job);
 * // signature: "a3f2b8c9..." (deterministic for same stable params)
 */
export function calculateIntentSignature(job: AguiRunJob): string {
  const stableParams = extractStableParameters(job);
  const normalized = normalizeObject(stableParams);

  // Calculate SHA256 hash
  const hash = createHash('sha256');
  hash.update(normalized);
  return hash.digest('hex');
}

/**
 * Verify that two jobs have the same intent
 * Useful for testing and debugging
 *
 * @param job1 - First job
 * @param job2 - Second job
 * @returns True if both jobs have the same intent signature
 */
export function haveSameIntent(job1: AguiRunJob, job2: AguiRunJob): boolean {
  return calculateIntentSignature(job1) === calculateIntentSignature(job2);
}

/**
 * Create a unique execution ID combining correlationId and signature
 * This can be used for detailed audit logging
 *
 * @param correlationId - Unique correlation ID for this execution
 * @param signature - Intent signature
 * @returns Combined execution identifier
 */
export function createExecutionId(correlationId: string, signature: string): string {
  return `${correlationId}:${signature.substring(0, 16)}`;
}

/**
 * Validate that a signature matches the expected format
 * SHA256 produces 64 hex characters
 *
 * @param signature - Signature to validate
 * @returns True if signature is valid format
 */
export function isValidSignature(signature: string): boolean {
  return /^[a-f0-9]{64}$/i.test(signature);
}

/**
 * Get a short signature for display purposes
 * Takes first 8 characters for readability
 *
 * @param signature - Full signature
 * @returns Shortened signature
 */
export function getShortSignature(signature: string): string {
  return signature.substring(0, 8);
}
