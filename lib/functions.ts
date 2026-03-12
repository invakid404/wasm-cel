/**
 * Type-safe builder for CEL function definitions
 */

import type {
  CELFunctionDefinition,
  CELFunctionParam,
  CELTypeDef,
  EnvWithExtensions,
  TypeExtensionHKT,
} from "./types.js";
import type { CELOptionalType } from "./options/optionalTypes.js";

type CELFunctionContext = TypeExtensionHKT[] | EnvWithExtensions<any>;

type ResolveFunctionExtensions<Context> = Context extends TypeExtensionHKT[]
  ? Context
  : Context extends EnvWithExtensions<infer Exts>
    ? Exts
    : [];

/**
 * Maps a CEL type definition to its corresponding TypeScript type.
 *
 * Useful for deriving the TS type that a CEL value will have at runtime,
 * e.g. when building wrappers or utilities on top of {@link CELFunction}.
 *
 * @example
 * ```typescript
 * import type { CELTypeToTS } from "wasm-cel";
 *
 * type N = CELTypeToTS<"int">;    // number
 * type S = CELTypeToTS<"string">; // string
 * type L = CELTypeToTS<{ kind: "list"; elementType: "bool" }>; // boolean[]
 * ```
 */
export type CELTypeToTS<
  T extends CELTypeDef<any>,
  Depth extends readonly unknown[] = [],
> = Depth["length"] extends 5
  ? any // Limit recursion depth to 5 levels
  : T extends "bool"
    ? boolean
    : T extends "int" | "uint" | "double"
      ? number
      : T extends "string"
        ? string
        : T extends "bytes"
          ? string
          : T extends { kind: "list"; elementType: infer E }
            ? E extends CELTypeDef
              ? Array<CELTypeToTS<E, [...Depth, unknown]>>
              : never
            : T extends { kind: "map"; keyType: infer K; valueType: infer V }
              ? V extends CELTypeDef
                ? Record<string, CELTypeToTS<V, [...Depth, unknown]>>
                : never
              : T extends CELOptionalType<infer Inner>
                ? CELTypeToTS<Inner, [...Depth, unknown]> | null
              : T extends "dyn"
                ? any
                : T extends "null"
                  ? null
                  : T extends "timestamp"
                    ? Date
                    : T extends "duration"
                      ? string
                      : never;

/**
 * Extracts a TypeScript parameter-type tuple from CEL function parameter definitions.
 *
 * Given a tuple of {@link CELFunctionParam} entries (as accumulated by the builder),
 * produces the matching tuple of TypeScript types — the same tuple used for the
 * `impl` callback signature in {@link CELFunction.implement}.
 *
 * @example
 * ```typescript
 * import type { ExtractParamTypes, CELFunctionParam } from "wasm-cel";
 *
 * type Params = readonly [
 *   { name: "a"; type: "int"; optional: false },
 *   { name: "b"; type: "string"; optional: false },
 *   { name: "c"; type: "bool"; optional: true },
 * ];
 *
 * type Args = ExtractParamTypes<Params>; // [number, string, boolean | undefined]
 * ```
 */
export type ExtractParamTypes<P extends readonly CELFunctionParam<any>[]> = {
  [K in keyof P]: P[K] extends CELFunctionParam
    ? P[K]["optional"] extends true
      ? CELTypeToTS<P[K]["type"]> | undefined
      : CELTypeToTS<P[K]["type"]>
    : never;
};

/**
 * Builder class for creating type-safe CEL function definitions
 *
 * @example
 * ```typescript
 * const add = CELFunction.new("add")
 *   .param("a", "int")
 *   .param("b", "int")
 *   .returns("int")
 *   .implement((a, b) => a + b);
 * ```
 */
type BuilderStage = "params" | "returns";

export class CELFunction<
  Context extends CELFunctionContext | [] = [],
  Stage extends BuilderStage = "params",
  Params extends readonly CELFunctionParam<ResolveFunctionExtensions<Context>>[] = readonly [],
  ReturnType extends CELTypeDef<ResolveFunctionExtensions<Context>> = "dyn",
> {
  private readonly stageMarker!: Stage;
  private name: string;
  private readonly params: CELFunctionParam<ResolveFunctionExtensions<Context>>[];
  private returnType: CELTypeDef<ResolveFunctionExtensions<Context>>;
  private overloads: CELFunctionDefinition[] = [];

  private constructor(
    name: string,
    params: CELFunctionParam<ResolveFunctionExtensions<Context>>[] = [],
    returnType: CELTypeDef<ResolveFunctionExtensions<Context>> = "dyn",
    overloads: CELFunctionDefinition[] = [],
  ) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error(
        `Invalid function name: ${name}. Must be a valid CEL identifier.`,
      );
    }
    this.name = name;
    this.params = params;
    this.returnType = returnType;
    this.overloads = [...overloads];
  }

  /**
   * Create a new CEL function builder
   * @param name - The name of the function
   * @returns A builder instance for chaining
   *
   * @example
   * ```typescript
   * const add = CELFunction.new("add")
   *   .param("a", "int")
   *   .param("b", "int")
   *   .returns("int")
   *   .implement((a, b) => a + b);
   * ```
   */
  static new<Context extends CELFunctionContext | [] = []>(
    name: string,
  ): CELFunction<Context, "params", readonly [], "dyn"> {
    return new CELFunction<Context, "params", readonly [], "dyn">(name);
  }

  /**
   * Add a parameter to the function
   */
  param<
    T extends CELTypeDef<ResolveFunctionExtensions<Context>>,
    Optional extends boolean = false,
  >(
    this: CELFunction<Context, "params", Params, ReturnType>,
    name: string,
    type: T,
    optional?: Optional,
  ): CELFunction<
    Context,
    "params",
    readonly [...Params, { name: string; type: T; optional: Optional }],
    ReturnType
  > {
    const newParams = [
      ...this.params,
      { name, type, optional: (optional ?? false) as Optional },
    ] as CELFunctionParam<ResolveFunctionExtensions<Context>>[];
    return new CELFunction<
      Context,
      "params",
      readonly [...Params, { name: string; type: T; optional: Optional }],
      ReturnType
    >(this.name, newParams, this.returnType, this.overloads);
  }

  /**
   * Set the return type of the function
   */
  returns<T extends CELTypeDef<ResolveFunctionExtensions<Context>>>(
    this: CELFunction<Context, "params", Params, ReturnType>,
    type: T,
  ): CELFunction<Context, "returns", Params, T> {
    return new CELFunction<Context, "returns", Params, T>(
      this.name,
      this.params,
      type,
      this.overloads,
    );
  }

  /**
   * Set the implementation function and return the final definition
   */
  implement(
    this: CELFunction<Context, "returns", Params, ReturnType>,
    impl: (...args: ExtractParamTypes<Params>) => CELTypeToTS<ReturnType>,
  ): CELFunctionDefinition {
    const definition = {
      name: this.name,
      params: [...this.params],
      returnType: this.returnType,
      impl: impl as (...args: any[]) => any,
    } as CELFunctionDefinition;

    if (this.overloads.length > 0) {
      definition.overloads = this.overloads;
    }

    return definition;
  }

  /**
   * Add an overload variant of this function
   */
  overload(
    this: CELFunction<Context, "returns", Params, ReturnType>,
    overload: CELFunctionDefinition,
  ): CELFunction<Context, "returns", Params, ReturnType> {
    if (overload.name !== this.name) {
      throw new Error(
        `Overload name mismatch: expected ${this.name}, got ${overload.name}`,
      );
    }
    this.overloads.push(overload);
    return this;
  }
}

/**
 * Helper function to create a list type
 */
export function listType<Exts extends TypeExtensionHKT[] = []>(
  elementType: CELTypeDef<Exts>,
): {
  kind: "list";
  elementType: CELTypeDef<Exts>;
} {
  return { kind: "list", elementType };
}

/**
 * Helper function to create a map type
 */
export function mapType(
  keyType: CELTypeDef,
  valueType: CELTypeDef,
): { kind: "map"; keyType: CELTypeDef; valueType: CELTypeDef } {
  return { kind: "map", keyType, valueType };
}

export function optionalType<const T extends CELTypeDef<any>>(
  innerType: T,
): CELOptionalType<T> {
  return { kind: "optional", innerType };
}
