import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { setInitFunction, Program, Env } from "./core.js";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load wasm_exec.cjs if it exists, otherwise use a fallback
// wasm_exec.cjs is a CommonJS file, so we use createRequire to load it
let wasmExecPath = path.join(__dirname, "..", "wasm_exec.cjs");
if (!fs.existsSync(wasmExecPath)) {
  // Try to find it in Go installation (as .js, we'll load it as .cjs)
  const goRoot =
    process.env.GOROOT ||
    execSync("go env GOROOT", { encoding: "utf-8" }).trim();
  const goWasmExecPath = path.join(goRoot, "misc", "wasm", "wasm_exec.js");
  if (fs.existsSync(goWasmExecPath)) {
    wasmExecPath = goWasmExecPath;
  }
}

if (fs.existsSync(wasmExecPath)) {
  // Convert to absolute path for createRequire
  const absoluteWasmExecPath = path.resolve(wasmExecPath);
  const require = createRequire(import.meta.url);
  require(absoluteWasmExecPath);
} else {
  throw new Error(
    `wasm_exec.cjs not found. Please ensure Go is installed and run 'pnpm run build:copy-wasm-exec' to copy wasm_exec.js`,
  );
}

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the WASM module (Node.js version - auto-loads from file system)
 * @returns {Promise<void>}
 */
async function init(): Promise<void> {
  if (isInitialized) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise<void>((resolve, reject) => {
    const wasmPath = path.join(__dirname, "..", "main.wasm");

    if (!fs.existsSync(wasmPath)) {
      reject(
        new Error(
          `WASM file not found at ${wasmPath}. Please build it first using 'pnpm run build' or 'go build -o main.wasm -target wasm ./cmd/wasm'`,
        ),
      );
      return;
    }

    const go = new Go();
    const wasmBuffer = fs.readFileSync(wasmPath);

    WebAssembly.instantiate(wasmBuffer, go.importObject)
      .then((result: WebAssembly.WebAssemblyInstantiatedSource) => {
        go.run(result.instance);
        isInitialized = true;
        resolve();
      })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        reject(
          new Error(`Failed to instantiate WASM module: ${error.message}`),
        );
      });
  });

  return initPromise;
}

// Set the init function in core
setInitFunction(init);

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
export type { CELTypeToTS, ExtractParamTypes } from "./functions.js";
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

// Export init function for Node.js (no parameters needed - auto-loads)
export { init };
