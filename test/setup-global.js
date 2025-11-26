// Global setup for all tests
// This runs before any test files and initializes the WASM module for browser tests

import { beforeAll } from "vitest";
import { init } from "../dist/index.js";

// Only run in browser environment
if (typeof window !== "undefined") {
  // Use a flag to ensure we only try to initialize once across all test files
  let initAttempted = false;

  beforeAll(async () => {
    // Skip if we've already attempted initialization (init() handles idempotency)
    if (initAttempted) {
      return;
    }
    initAttempted = true;

    try {
      // In vitest browser mode, files are served from the project root
      // Use absolute paths from the root
      await init("/main.wasm", "/wasm_exec.cjs");
    } catch (error) {
      // If absolute paths fail, try with URL construction
      try {
        const wasmPath = new URL("/main.wasm", import.meta.url).href;
        const wasmExecPath = new URL("/wasm_exec.cjs", import.meta.url).href;
        await init(wasmPath, wasmExecPath);
      } catch (urlError) {
        console.error(
          "[global-setup] Failed to initialize WASM module. Tried both absolute and URL paths.",
        );
        console.error("[global-setup] Absolute path error:", error.message);
        console.error("[global-setup] URL path error:", urlError.message);
        throw urlError;
      }
    }
  });
}
