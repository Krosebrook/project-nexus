import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./test-setup.ts"],
    include: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "~backend/client": path.resolve(__dirname, "./client"),
      "~backend": path.resolve(__dirname, "../backend"),
    },
  },
});
