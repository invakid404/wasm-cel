/**
 * Type-safe builder for CEL function definitions
 */

import type {
  CELFunctionDefinition,
  CELFunctionParam,
  CELTypeDef,
} from "./types.js";

/**
 * Maps CEL types to TypeScript types
 * Uses a depth counter to limit recursion and avoid "excessively deep" errors
 */
type CELTypeToTS<
  T extends CELTypeDef,
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
 * Extracts TypeScript parameter types from a tuple of CEL function parameters
 */
type ExtractParamTypes<P extends readonly CELFunctionParam[]> = {
  [K in keyof P]: P[K] extends CELFunctionParam
    ? CELTypeToTS<P[K]["type"]>
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
export class CELFunction<
  Params extends readonly CELFunctionParam[] = readonly [],
  ReturnType extends CELTypeDef = "dyn",
> {
  private name: string;
  private readonly params: CELFunctionParam[];
  private returnType: CELTypeDef;
  private overloads: CELFunctionDefinition[] = [];

  private constructor(
    name: string,
    params: CELFunctionParam[] = [],
    returnType: CELTypeDef = "dyn",
  ) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error(
        `Invalid function name: ${name}. Must be a valid CEL identifier.`,
      );
    }
    this.name = name;
    this.params = params;
    this.returnType = returnType;
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
  static new(name: string): CELFunction<readonly [], "dyn"> {
    return new CELFunction(name);
  }

  /**
   * Add a parameter to the function
   */
  param<T extends CELTypeDef>(
    name: string,
    type: T,
    optional = false,
  ): CELFunction<
    [...Params, { name: string; type: T; optional: boolean }],
    ReturnType
  > {
    const newParams = [
      ...this.params,
      { name, type, optional },
    ] as CELFunctionParam[];
    return new CELFunction(this.name, newParams, this.returnType);
  }

  /**
   * Set the return type of the function
   */
  returns<T extends CELTypeDef>(type: T): CELFunction<Params, T> {
    return new CELFunction(this.name, this.params, type);
  }

  /**
   * Set the implementation function and return the final definition
   */
  implement(
    impl: (...args: ExtractParamTypes<Params>) => CELTypeToTS<ReturnType>,
  ): CELFunctionDefinition {
    const definition: CELFunctionDefinition = {
      name: this.name,
      params: [...this.params],
      returnType: this.returnType,
      impl: impl as (...args: any[]) => any,
    };

    if (this.overloads.length > 0) {
      definition.overloads = this.overloads;
    }

    return definition;
  }

  /**
   * Add an overload variant of this function
   */
  overload(overload: CELFunctionDefinition): this {
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
export function listType(elementType: CELTypeDef): {
  kind: "list";
  elementType: CELTypeDef;
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
