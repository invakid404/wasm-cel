import { _envExtensions } from "./types.js";
import type {
  CELFunctionDefinition,
  CELTypeDef,
  EnvOptions,
  EnvWithExtensions,
  InferExtensions,
  TypeCheckResult,
  TypeExtensionHKT,
} from "./types.js";

// Init function that will be set by the environment-specific entry point
let initFn: (() => Promise<void>) | null = null;

/**
 * Set the initialization function (called by node.ts or browser.ts)
 * @internal
 */
export function setInitFunction(fn: () => Promise<void>): void {
  initFn = fn;
}

/**
 * Call the initialization function
 * @internal
 */
async function init(): Promise<void> {
  if (!initFn) {
    throw new Error(
      "WASM module not initialized. Please call init() first. In Node.js, this happens automatically. In browsers, you must call init(wasmBytes) with the WASM module bytes.",
    );
  }
  await initFn();
}

// Base64 encoding/decoding helpers for bytes support
const base64Encode =
  typeof Buffer !== "undefined"
    ? (bytes: Uint8Array) => Buffer.from(bytes).toString("base64")
    : (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

const base64Decode =
  typeof Buffer !== "undefined"
    ? (str: string) => new Uint8Array(Buffer.from(str, "base64"))
    : (str: string) => {
        const binary = atob(str);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      };

/**
 * Recursively prepare variables for serialization to WASM.
 * Converts Uint8Array/Buffer values to tagged bytes objects.
 * @internal
 */
function prepareVarsForWasm(vars: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(vars)) {
    result[key] = encodeBytes(value);
  }
  return result;
}

function encodeBytes(value: any): any {
  if (value instanceof Uint8Array) {
    return { $bytes: base64Encode(value) };
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return { $bytes: (value as Buffer).toString("base64") };
  }
  if (Array.isArray(value)) {
    return value.map(encodeBytes);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = encodeBytes(v);
    }
    return result;
  }
  return value;
}

/**
 * Recursively decode tagged bytes objects in WASM results to Uint8Array.
 * @internal
 */
function decodeBytes(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    // Detect tagged bytes: { $bytes: "<base64>" }
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === "$bytes" && typeof value.$bytes === "string") {
      return base64Decode(value.$bytes);
    }
    // Recursively decode map values
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = decodeBytes(v);
    }
    return result;
  }
  if (Array.isArray(value)) {
    return value.map(decodeBytes);
  }
  return value;
}

/**
 * Serialize a CEL type definition to a format that can be sent to Go
 */
function serializeTypeDef(type: CELTypeDef<any>): any {
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
      if ((type as any).kind === "optional") {
        return {
          kind: "optional",
          innerType: serializeTypeDef((type as any).innerType),
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

function expandFunctionDefinitions(
  functions: CELFunctionDefinition[],
): CELFunctionDefinition[] {
  const expanded: CELFunctionDefinition[] = [];

  const visit = (fn: CELFunctionDefinition): void => {
    expanded.push(fn);
    if (fn.overloads && fn.overloads.length > 0) {
      for (const overload of fn.overloads) {
        visit(overload);
      }
    }
  };

  for (const fn of functions) {
    visit(fn);
  }

  return expanded;
}

function serializeFunctionDefs(functions: CELFunctionDefinition[]): Array<{
  name: string;
  params: Array<{ name: string; type: any; optional?: boolean }>;
  returnType: any;
  implID: string;
}> {
  const flattened = expandFunctionDefinitions(functions);

  return flattened.map((fn, index) => {
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
        const preparedVars = vars ? prepareVarsForWasm(vars) : {};
        const result = globalObj.evalProgram(this.programID, preparedVars);

        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(decodeBytes(result.result));
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
export class Env<Exts extends TypeExtensionHKT[] = []>
  implements EnvWithExtensions<Exts>
{
  private envID: string;
  private destroyed: boolean = false;
  declare readonly [_envExtensions]?: Exts;

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
  static async new<Opts extends readonly import("./options/index.js").EnvOptionInput<any>[] = []>(
    options?: Omit<EnvOptions<InferExtensions<Opts>>, "options"> & {
      options?: Opts;
    },
  ): Promise<Env<InferExtensions<Opts>>> {
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
    const env = await new Promise<Env<InferExtensions<Opts>>>((resolve, reject) => {
      try {
        const globalObj =
          typeof globalThis !== "undefined" ? globalThis : global;
        const result = globalObj.createEnv(varDecls, serializedFuncDefs);

        if (result.error) {
          reject(new Error(result.error));
        } else if (!result.envID) {
          reject(new Error("Environment creation failed: no envID returned"));
        } else {
          resolve(new Env<InferExtensions<Opts>>(result.envID));
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        reject(new Error(`WASM call failed: ${error.message}`));
      }
    });

    // INTERNAL: If options were provided, extend the environment
    // This allows options to perform JavaScript-side setup (like registering functions)
    if (options?.options && options.options.length > 0) {
      await env._extendWithOptions([...options.options]);
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
