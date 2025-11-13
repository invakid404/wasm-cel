import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import type {
  CELFunctionDefinition,
  CELTypeDef,
  EvaluateOptions,
} from "./types.js";

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
 * Initialize the WASM module
 * @returns {Promise<void>}
 */
export async function init(): Promise<void> {
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

/**
 * Result of a CEL expression evaluation
 */
export interface EvaluateResult {
  /** The result of the evaluation, or null if there was an error */
  result: any;
  /** Error message if evaluation failed, or null if successful */
  error: string | null;
}

/**
 * Variables to use in the CEL expression
 */
export type Variables = Record<string, any> | null;

/**
 * Serialize a CEL type definition to a format that can be sent to Go
 */
function serializeTypeDef(type: CELTypeDef): any {
  if (typeof type === "string") {
    return type;
  }
  if (typeof type === "object" && type !== null) {
    if ("kind" in type) {
      if (type.kind === "list") {
        return {
          kind: "list",
          elementType: serializeTypeDef(type.elementType),
        };
      }
      if (type.kind === "map") {
        return {
          kind: "map",
          keyType: serializeTypeDef(type.keyType),
          valueType: serializeTypeDef(type.valueType),
        };
      }
    }
  }
  return "dyn"; // Fallback to dynamic type
}

/**
 * Serialize function definitions for transmission to Go
 */
// Counter for generating unique implementation IDs
let implIDCounter = 0;

function serializeFunctionDefs(functions: CELFunctionDefinition[]): Array<{
  name: string;
  params: Array<{ name: string; type: any; optional?: boolean }>;
  returnType: any;
  implID: string;
}> {
  return functions.map((fn, index) => {
    // Generate a unique implementation ID
    const implID = `${fn.name}_${index}_${++implIDCounter}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Register the JavaScript function implementation
    const globalObj = typeof globalThis !== "undefined" ? globalThis : global;
    if (typeof globalObj.registerCELFunction === "function") {
      const registerResult = globalObj.registerCELFunction(implID, fn.impl);
      if (registerResult.error) {
        throw new Error(
          `Failed to register function ${fn.name}: ${registerResult.error}`,
        );
      }
    } else {
      throw new Error(
        "registerCELFunction not available. Make sure WASM is initialized.",
      );
    }

    return {
      name: fn.name,
      params: fn.params.map((param) => ({
        name: param.name,
        type: serializeTypeDef(param.type),
        optional: param.optional,
      })),
      returnType: serializeTypeDef(fn.returnType),
      implID,
    };
  });
}

/**
 * Evaluate a CEL expression with variables and optional custom functions
 * @param expr - The CEL expression to evaluate
 * @param options - Options including variables and custom functions
 * @returns Promise resolving to the evaluation result
 * @throws Error if the expression is invalid or evaluation fails
 *
 * @example
 * ```typescript
 * const result = await evaluateCEL("add(1, 2)", {
 *   vars: {},
 *   functions: [
 *     celFunction("add")
 *       .param("a", "int")
 *       .param("b", "int")
 *       .returns("int")
 *       .implement((a, b) => a + b)
 *   ]
 * });
 * ```
 */
export async function evaluateCEL(
  expr: string,
  options?: EvaluateOptions | Variables,
): Promise<EvaluateResult> {
  // Ensure WASM is initialized
  await init();

  if (typeof expr !== "string") {
    throw new Error("First argument must be a string (CEL expression)");
  }

  // Handle backward compatibility: if second arg is an object but not EvaluateOptions, treat as vars
  let vars: Variables = null;
  let functions: CELFunctionDefinition[] | undefined;

  if (options !== undefined && options !== null) {
    if (typeof options !== "object" || Array.isArray(options)) {
      throw new Error(
        "Second argument must be an object (variables map or options) or null",
      );
    }

    // Check if it's EvaluateOptions by looking for 'vars' or 'functions' keys
    if ("vars" in options || "functions" in options) {
      // It's EvaluateOptions
      const opts = options as EvaluateOptions;
      vars = opts.vars ?? null;
      functions = opts.functions;
    } else {
      // It's Variables (backward compatibility)
      vars = options as Variables;
    }
  }

  if (vars !== null && typeof vars !== "object") {
    throw new Error("Variables must be an object (variables map) or null");
  }

  // Serialize function definitions if provided
  let serializedFuncDefs: any = null;
  if (functions && functions.length > 0) {
    serializedFuncDefs = serializeFunctionDefs(functions);
  }

  return new Promise<EvaluateResult>((resolve, reject) => {
    try {
      // Call the global evaluateCEL function exposed by Go
      // In Node.js ESM, globalThis is the global object
      const globalObj = typeof globalThis !== "undefined" ? globalThis : global;
      const result = globalObj.evaluateCEL(
        expr,
        vars || {},
        serializedFuncDefs,
      );

      // Convert the result to a plain JavaScript object
      const resultObj: EvaluateResult = {
        result: result.result !== undefined ? result.result : null,
        error: result.error || null,
      };

      if (resultObj.error) {
        reject(new Error(resultObj.error));
      } else {
        resolve(resultObj);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      reject(new Error(`WASM call failed: ${error.message}`));
    }
  });
}

// Re-export types and functions
export type {
  CELType,
  CELTypeDef,
  CELListType,
  CELMapType,
  CELFunctionDefinition,
  CELFunctionParam,
  EvaluateOptions,
} from "./types.js";

export {
  celFunction,
  listType,
  mapType,
  CELFunctionBuilder,
} from "./functions.js";
