/**
 * Centralized log message catalog for deployment stages.
 * Maintains backward compatibility while allowing evolution of log messages.
 */

export const LogPhrases = {
  // Resume
  RESUME: "Resuming from saved state",

  // Validation
  VALIDATING_LEGACY: "Validating deployment configuration",
  VALIDATING_START: "Starting validation...",
  VALIDATING_DONE: "Validation completed successfully",

  // Build
  BUILD_START: "Building project",
  BUILD_DONE: "Build completed successfully",

  // Test
  TESTS_START: "Running test suite",
  TESTS_DONE: "All tests passed",

  // Migrations
  MIGRATIONS_START: "Running database migrations",
  MIGRATIONS_DONE: "Migrations completed",

  // Deploy
  DEPLOY_START: "Deploying artifacts",
  DEPLOY_DONE: "Deployment completed",

  // Health
  HEALTH_START: "Performing health checks",
  HEALTH_DONE: "Health checks passed",
} as const;

export type LogPhrase = typeof LogPhrases[keyof typeof LogPhrases];
