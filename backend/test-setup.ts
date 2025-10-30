/**
 * Backend test setup file.
 * Runs before all backend tests.
 */

import { beforeAll } from "vitest";
import { runSchemaPreflight } from "./db/schema-preflight";

beforeAll(async () => {
  await runSchemaPreflight();
});
