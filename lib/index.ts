import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import type { CELFunctionDefinition, CELTypeDef, EnvOptions } from "./types.js";

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
 * A compiled CEL program that can be evaluated with variables
 */
export class Program {
  private programID: string;

  constructor(programID: string) {
    this.programID = programID;
  }

  /**
   * Evaluate the compiled program with the given variables
   * @param vars - Variables to use in the evaluation
   * @returns Promise resolving to the evaluation result
   * @throws Error if evaluation fails
   */
  async eval(vars: Record<string, any> | null = null): Promise<any> {
    await init();

    return new Promise<any>((resolve, reject) => {
      try {
        const globalObj =
          typeof globalThis !== "undefined" ? globalThis : global;
        const result = globalObj.evalProgram(this.programID, vars || {});

        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.result);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        reject(new Error(`WASM call failed: ${error.message}`));
      }
    });
  }
}

/**
 * A CEL environment that holds variable declarations and function definitions
 */
export class Env {
  private envID: string;

  private constructor(envID: string) {
    this.envID = envID;
  }

  /**
   * Create a new CEL environment
   * @param options - Options including variable declarations and function definitions
   * @returns Promise resolving to a new Env instance
   * @throws Error if environment creation fails
   *
   * @example
   * ```typescript
   * const env = await Env.new({
   *   variables: [
   *     { name: "x", type: "int" },
   *     { name: "y", type: "int" }
   *   ],
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
  static async new(options?: EnvOptions): Promise<Env> {
    await init();

    // Serialize variable declarations
    const varDecls = (options?.variables || []).map((v) => ({
      name: v.name,
      type: serializeTypeDef(v.type),
    }));

    // Serialize function definitions if provided
    let serializedFuncDefs: any = null;
    if (options?.functions && options.functions.length > 0) {
      serializedFuncDefs = serializeFunctionDefs(options.functions);
    }

    return new Promise<Env>((resolve, reject) => {
      try {
        const globalObj =
          typeof globalThis !== "undefined" ? globalThis : global;
        const result = globalObj.createEnv(varDecls, serializedFuncDefs);

        if (result.error) {
          reject(new Error(result.error));
        } else if (!result.envID) {
          reject(new Error("Environment creation failed: no envID returned"));
        } else {
          resolve(new Env(result.envID));
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        reject(new Error(`WASM call failed: ${error.message}`));
      }
    });
  }

  /**
   * Compile a CEL expression in this environment
   * @param expr - The CEL expression to compile
   * @returns Promise resolving to a compiled Program
   * @throws Error if compilation fails
   *
   * @example
   * ```typescript
   * const env = await Env.new({
   *   variables: [{ name: "x", type: "int" }]
   * });
   * const program = await env.compile("x + 10");
   * const result = await program.eval({ x: 5 });
   * console.log(result); // 15
   * ```
   */
  async compile(expr: string): Promise<Program> {
    await init();

    if (typeof expr !== "string") {
      throw new Error("Expression must be a string");
    }

    return new Promise<Program>((resolve, reject) => {
      try {
        const globalObj =
          typeof globalThis !== "undefined" ? globalThis : global;
        const result = globalObj.compileExpr(this.envID, expr);

        if (result.error) {
          reject(new Error(result.error));
        } else if (!result.programID) {
          reject(new Error("Compilation failed: no programID returned"));
        } else {
          resolve(new Program(result.programID));
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        reject(new Error(`WASM call failed: ${error.message}`));
      }
    });
  }
}

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
} from "./types.js";

export {
  celFunction,
  listType,
  mapType,
  CELFunctionBuilder,
} from "./functions.js";
