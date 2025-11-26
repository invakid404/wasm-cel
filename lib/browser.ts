import { setInitFunction, Program, Env } from "./core.js";

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Load wasm_exec.js from a URL (if not already loaded)
 * @param wasmExecUrl - URL to wasm_exec.js (optional, assumes already loaded if not provided)
 * @returns Promise that resolves when wasm_exec.js is loaded
 */
async function loadWasmExec(wasmExecUrl?: string | URL): Promise<void> {
  // Check if Go is already available
  const globalObj = typeof globalThis !== "undefined" ? globalThis : global;
  if (typeof globalObj.Go !== "undefined") {
    return; // Already loaded
  }

  if (!wasmExecUrl) {
    throw new Error(
      "Go WASM runtime (wasm_exec.js) not found. Please load it before initializing the WASM module. " +
        "You can either:\n" +
        "1. Load it via script tag: <script src='path/to/wasm_exec.js'></script>\n" +
        "2. Or pass wasmExecUrl to init() to load it dynamically.",
    );
  }

  // Load wasm_exec.js dynamically
  const url = typeof wasmExecUrl === "string" ? wasmExecUrl : wasmExecUrl.href;
  
  // Check if we're in an environment with document (browser main thread)
  if (typeof document === "undefined") {
    throw new Error(
      "document is not available. In environments like Web Workers, please load wasm_exec.js manually before calling init().",
    );
  }
  
  const script = document.createElement("script");
  script.src = url;
  script.type = "text/javascript";

  return new Promise<void>((resolve, reject) => {
    script.onload = () => {
      if (typeof globalObj.Go === "undefined") {
        reject(
          new Error(
            "wasm_exec.js loaded but Go class not found. Make sure you're using the correct wasm_exec.js file.",
          ),
        );
      } else {
        resolve();
      }
    };
    script.onerror = () => {
      reject(
        new Error(
          `Failed to load wasm_exec.js from ${url}. Make sure the URL is correct and accessible.`,
        ),
      );
    };
    document.head.appendChild(script);
  });
}

/**
 * Internal init function that core will call
 */
async function internalInit(): Promise<void> {
  if (!isInitialized) {
    throw new Error(
      "WASM module not initialized. In browsers, you must call init(wasmBytes) with the WASM module bytes or URL before using the library.",
    );
  }
}

/**
 * Initialize the WASM module (Browser version - requires WASM bytes)
 * @param wasmBytes - The WASM module bytes. Can be:
 *   - Uint8Array: Direct bytes
 *   - string: URL to fetch the WASM file from
 *   - URL: URL object pointing to the WASM file
 * @param wasmExecUrl - Optional URL to wasm_exec.js if it needs to be loaded dynamically
 * @returns {Promise<void>}
 */
async function init(
  wasmBytes: Uint8Array | string | URL,
  wasmExecUrl?: string | URL,
): Promise<void> {
  if (isInitialized) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    // Load wasm_exec.js if needed
    await loadWasmExec(wasmExecUrl);

    // Get the Go class
    const globalObj = typeof globalThis !== "undefined" ? globalThis : global;
    if (typeof globalObj.Go === "undefined") {
      throw new Error(
        "Go WASM runtime not available. Please ensure wasm_exec.js is loaded.",
      );
    }

    // Load WASM bytes
    let wasmBuffer: Uint8Array;
    if (wasmBytes instanceof Uint8Array) {
      wasmBuffer = wasmBytes;
    } else {
      // Fetch from URL
      const url = typeof wasmBytes === "string" ? wasmBytes : wasmBytes.href;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch WASM file from ${url}: ${response.statusText}`,
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      wasmBuffer = new Uint8Array(arrayBuffer);
    }

    // Instantiate WASM
    const go = new globalObj.Go();
    // TypeScript needs help with overload resolution - cast through unknown
    const result = (await WebAssembly.instantiate(
      wasmBuffer,
      go.importObject,
    )) as unknown as WebAssembly.WebAssemblyInstantiatedSource;
    go.run(result.instance);
    isInitialized = true;
  })();

  return initPromise;
}

// Set the init function in core (this is what core will call to check initialization)
setInitFunction(internalInit);

// Re-export everything from core
export { Program, Env } from "./core.js";

// Re-export types and functions
export type {
  CELType,
  CELTypeDef,
  CELListType,
  CELMapType,
  CELFunctionDefinition,
  CELFunctionParam,
  EnvOptions,
  VariableDeclaration,
  TypeCheckResult,
  CompilationIssue,
  CompilationResult,
} from "./types.js";

export { listType, mapType, CELFunction } from "./functions.js";
export { Options } from "./options/index.js";
export type {
  EnvOptionConfig,
  OptionalTypesConfig,
  ValidationIssue,
  ValidationContext,
  ValidatorResult,
  ASTValidatorFunction,
  ASTValidatorsConfig,
} from "./options/index.js";

// Export init function for browser (requires wasmBytes parameter)
export { init };
