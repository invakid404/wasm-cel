import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    // Test file patterns
    include: ["**/test/**/*.test.js"],

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["dist/**/*.js"],
      exclude: ["**/node_modules/**"],
    },

    // Global test timeout
    testTimeout: 10000,

    // Globals for Jest-like API (describe, test, expect, etc.)
    globals: true,

    // Reporter configuration
    reporters: ["verbose"],

    // Output directory for reports
    outputFile: {
      json: "./test-results.json",
      html: "./test-results.html",
    },

    // Default to node environment
    environment: "node",

    // Browser configuration - configured but not enabled by default
    // Use --browser flag to enable browser testing
    browser: {
      provider: playwright({}),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
    // Global setup files - runs before all tests
    // The setup-global.js file initializes the WASM module for browser tests
    setupFiles: ["./test/setup-global.js"],
  },
});
