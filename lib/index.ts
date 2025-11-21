import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import type {
  CELFunctionDefinition,
  CELTypeDef,
  EnvOptions,
  TypeCheckResult,
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

// FinalizationRegistry for automatic cleanup
// This provides best-effort cleanup when objects are garbage collected
const programRegistry =
  typeof FinalizationRegistry !== "undefined"
    ? new FinalizationRegistry<string>((programID: string) => {
        // Best-effort cleanup when program is garbage collected
        try {
          const globalObj =
            typeof globalThis !== "undefined" ? globalThis : global;
          if (typeof globalObj.destroyProgram === "function") {
            globalObj.destroyProgram(programID);
          }
        } catch (err) {
          // Ignore errors during finalization - this is best-effort only
        }
      })
    : null;

const envRegistry =
  typeof FinalizationRegistry !== "undefined"
    ? new FinalizationRegistry<string>((envID: string) => {
        // Best-effort cleanup when environment is garbage collected
        try {
          const globalObj =
            typeof globalThis !== "undefined" ? globalThis : global;
          if (typeof globalObj.destroyEnv === "function") {
            globalObj.destroyEnv(envID);
          }
        } catch (err) {
          // Ignore errors during finalization - this is best-effort only
        }
      })
    : null;

/**
 * A compiled CEL program that can be evaluated with variables
 */
export class Program {
  private programID: string;
  private destroyed: boolean = false;

  constructor(programID: string) {
    this.programID = programID;
    // Register for automatic cleanup via FinalizationRegistry
    if (programRegistry) {
      programRegistry.register(this, programID);
    }
  }

  /**
   * Evaluate the compiled program with the given variables
   * @param vars - Variables to use in the evaluation
   * @returns Promise resolving to the evaluation result
   * @throws Error if evaluation fails or program has been destroyed
   */
  async eval(vars: Record<string, any> | null = null): Promise<any> {
    if (this.destroyed) {
      throw new Error("Program has been destroyed");
    }

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

  /**
   * Destroy this program and free associated WASM resources.
   * After calling destroy(), this program instance should not be used.
   * If FinalizationRegistry is available, resources will be automatically
   * cleaned up when the object is garbage collected, but explicit cleanup
   * is recommended.
   */
  destroy(): void {
    if (this.destroyed) {
      return; // Already destroyed, no-op
    }

    try {
      const globalObj = typeof globalThis !== "undefined" ? globalThis : global;
      if (typeof globalObj.destroyProgram === "function") {
        const result = globalObj.destroyProgram(this.programID);
        if (result.error) {
          // Log but don't throw - cleanup should be best-effort
          console.warn(`Failed to destroy program: ${result.error}`);
        }
      }
    } catch (err) {
      // Log but don't throw - cleanup should be best-effort
      console.warn(`Error destroying program: ${err}`);
    } finally {
      this.destroyed = true;
      // Unregister from FinalizationRegistry since we've explicitly cleaned up
      if (programRegistry) {
        programRegistry.unregister(this);
      }
    }
  }
}

/**
 * A CEL environment that holds variable declarations and function definitions
 */
export class Env {
  private envID: string;
  private destroyed: boolean = false;

  private constructor(envID: string) {
    this.envID = envID;
    // Register for automatic cleanup via FinalizationRegistry
    if (envRegistry) {
      envRegistry.register(this, envID);
    }
  }

  /**
   * Get the environment ID (useful for debugging or advanced use cases)
   */
  getID(): string {
    return this.envID;
  }

  /**
   * Create a new CEL environment
   * @param options - Options including variable declarations, function definitions, and environment options
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
   *     CELFunction.new("add")
   *       .param("a", "int")
   *       .param("b", "int")
   *       .returns("int")
   *       .implement((a, b) => a + b)
   *   ],
   *   options: [
   *     Options.optionalTypes()
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

    // INTERNAL: Create environment first without options, then extend if needed
    // This allows complex options to perform JavaScript-side setup before being applied
    const env = await new Promise<Env>((resolve, reject) => {
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

    // INTERNAL: If options were provided, extend the environment
    // This allows options to perform JavaScript-side setup (like registering functions)
    if (options?.options && options.options.length > 0) {
      await env._extendWithOptions(options.options);
    }

    return env;
  }

  /**
   * Compile a CEL expression in this environment
   * @param expr - The CEL expression to compile
   * @returns Promise resolving to a compiled Program
   * @throws Error if compilation fails or environment has been destroyed
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
    if (this.destroyed) {
      throw new Error("Environment has been destroyed");
    }

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

  /**
   * Compile a CEL expression with detailed results including warnings and issues
   * @param expr - The CEL expression to compile
   * @returns Promise resolving to detailed compilation results
   * @throws Error if environment has been destroyed
   *
   * @example
   * ```typescript
   * const result = await env.compileDetailed("x + y");
   * if (result.success) {
   *   console.log("Compiled successfully");
   *   if (result.issues.length > 0) {
   *     console.log("Warnings:", result.issues);
   *   }
   *   const evalResult = await result.program.eval({ x: 10, y: 20 });
   * } else {
   *   console.log("Compilation failed:", result.error);
   *   console.log("All issues:", result.issues);
   * }
   * ```
   */
  async compileDetailed(
    expr: string,
  ): Promise<import("./types.js").CompilationResult> {
    if (this.destroyed) {
      throw new Error("Environment has been destroyed");
    }

    await init();

    if (typeof expr !== "string") {
      throw new Error("Expression must be a string");
    }

    return new Promise<import("./types.js").CompilationResult>((resolve) => {
      try {
        const globalObj =
          typeof globalThis !== "undefined" ? globalThis : global;
        const result = (globalObj as any).compileExprDetailed(this.envID, expr);

        if (result.error && !result.programID) {
          // Compilation failed completely
          resolve({
            success: false,
            error: result.error,
            issues: result.issues || [],
            program: undefined,
          });
        } else if (result.programID) {
          // Compilation succeeded (possibly with warnings)
          resolve({
            success: true,
            error: undefined,
            issues: result.issues || [],
            program: new Program(result.programID),
          });
        } else {
          // Unexpected state
          resolve({
            success: false,
            error: "Compilation failed: no programID returned",
            issues: result.issues || [],
            program: undefined,
          });
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        resolve({
          success: false,
          error: `WASM call failed: ${error.message}`,
          issues: [],
          program: undefined,
        });
      }
    });
  }

  /**
   * Typecheck a CEL expression in this environment without compiling it
   * @param expr - The CEL expression to typecheck
   * @returns Promise resolving to the type information
   * @throws Error if typechecking fails or environment has been destroyed
   *
   * @example
   * ```typescript
   * const env = await Env.new({
   *   variables: [{ name: "x", type: "int" }, { name: "y", type: "int" }]
   * });
   * const typeInfo = await env.typecheck("x + y");
   * console.log(typeInfo.type); // "int"
   *
   * const listType = await env.typecheck("[1, 2, 3]");
   * console.log(listType.type); // { kind: "list", elementType: "int" }
   * ```
   */
  async typecheck(expr: string): Promise<TypeCheckResult> {
    if (this.destroyed) {
      throw new Error("Environment has been destroyed");
    }

    await init();

    if (typeof expr !== "string") {
      throw new Error("Expression must be a string");
    }

    return new Promise<TypeCheckResult>((resolve, reject) => {
      try {
        const globalObj =
          typeof globalThis !== "undefined" ? globalThis : global;
        const result = globalObj.typecheckExpr(this.envID, expr);

        if (result.error) {
          reject(new Error(result.error));
        } else if (result.type === undefined) {
          reject(new Error("Typecheck failed: no type returned"));
        } else {
          resolve({ type: result.type });
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        reject(new Error(`WASM call failed: ${error.message}`));
      }
    });
  }

  /**
   * Extend this environment with additional CEL environment options
   * @param options - Array of CEL environment option configurations or complex options with setup
   * @returns Promise that resolves when the environment has been extended
   * @throws Error if extension fails or environment has been destroyed
   *
   * @example
   * ```typescript
   * const env = await Env.new({
   *   variables: [{ name: "x", type: "int" }]
   * });
   *
   * // Add options after creation
   * await env.extend([Options.optionalTypes()]);
   * ```
   */
  async extend(
    options: import("./options/index.js").EnvOptionInput[],
  ): Promise<void> {
    return this._extendWithOptions(options);
  }

  /**
   * Internal method to extend environment with options
   * This method delegates to options that implement OptionWithSetup for complex operations
   * @private
   */
  private async _extendWithOptions(
    options: import("./options/index.js").EnvOptionInput[],
  ): Promise<void> {
    if (this.destroyed) {
      throw new Error("Environment has been destroyed");
    }

    await init();

    if (!options || options.length === 0) {
      return; // Nothing to extend
    }

    // Process options: delegate to options that can handle their own setup
    const processedOptions: import("./options/index.js").EnvOptionConfig[] = [];

    for (const option of options) {
      // Check if this option implements OptionWithSetup
      if (
        "setupAndProcess" in option &&
        typeof option.setupAndProcess === "function"
      ) {
        // Let the option handle its own complex setup operations
        const setupEnv: import("./options/index.js").OptionSetupEnvironment = {
          getID: () => this.getID(),
          registerFunction: async (
            name: string,
            impl: (...args: any[]) => any,
          ): Promise<string> => {
            if (this.destroyed) {
              throw new Error("Environment has been destroyed");
            }

            // Generate a unique implementation ID for this function
            const implID = `${name}_${this.envID}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

            // Register the JavaScript function implementation
            const globalObj =
              typeof globalThis !== "undefined" ? globalThis : global;
            if (typeof globalObj.registerCELFunction === "function") {
              const registerResult = globalObj.registerCELFunction(
                implID,
                impl,
              );
              if (registerResult.error) {
                throw new Error(
                  `Failed to register function ${name}: ${registerResult.error}`,
                );
              }
            } else {
              throw new Error(
                "registerCELFunction not available. Make sure WASM is initialized.",
              );
            }

            // Return the actual implementation ID that was registered
            return implID;
          },
        };
        const processedOption = await option.setupAndProcess(setupEnv);
        processedOptions.push(processedOption);
      } else {
        // Simple option configuration, pass through directly
        processedOptions.push(
          option as import("./options/index.js").EnvOptionConfig,
        );
      }
    }

    const serializedOptions = JSON.stringify(processedOptions);

    return new Promise<void>((resolve, reject) => {
      try {
        const globalObj =
          typeof globalThis !== "undefined" ? globalThis : global;
        const result = globalObj.extendEnv(this.envID, serializedOptions);

        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve();
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        reject(new Error(`WASM call failed: ${error.message}`));
      }
    });
  }

  /**
   * Destroy this environment and free associated WASM resources.
   * This will also clean up any registered JavaScript functions associated
   * with this environment.
   * After calling destroy(), this environment instance should not be used.
   * If FinalizationRegistry is available, resources will be automatically
   * cleaned up when the object is garbage collected, but explicit cleanup
   * is recommended.
   */
  destroy(): void {
    if (this.destroyed) {
      return; // Already destroyed, no-op
    }

    try {
      const globalObj = typeof globalThis !== "undefined" ? globalThis : global;
      if (typeof globalObj.destroyEnv === "function") {
        const result = globalObj.destroyEnv(this.envID);
        if (result.error) {
          // Log but don't throw - cleanup should be best-effort
          console.warn(`Failed to destroy environment: ${result.error}`);
        }
      }
    } catch (err) {
      // Log but don't throw - cleanup should be best-effort
      console.warn(`Error destroying environment: ${err}`);
    } finally {
      this.destroyed = true;
      // Unregister from FinalizationRegistry since we've explicitly cleaned up
      if (envRegistry) {
        envRegistry.unregister(this);
      }
    }
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
  TypeCheckResult,
  CompilationIssue,
  CompilationResult,
} from "./types.js";

export { listType, mapType, CELFunction } from "./functions.js";
export { Options } from "./options/index.js";
export type {
  EnvOptionConfig,
  OptionType,
  OptionalTypesConfig,
  ValidationIssue,
  ValidationContext,
  ValidatorResult,
  ASTValidatorFunction,
  ASTValidatorsConfig,
} from "./options/index.js";
