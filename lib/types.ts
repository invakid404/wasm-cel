/**
 * CEL type system definitions
 * These types correspond to CEL's type system and will be used for type checking
 */

// ============================================================
// HKT infrastructure for extensible CEL types
// ============================================================

export declare const _types: unique symbol;
type TypeExtensionFn = (...args: never[]) => unknown;

/**
 * Base higher-kinded type for CEL type extensions.
 *
 * Extensions implement this to declare what CEL types they contribute
 * to the type universe. The {@link _types} slot receives the full resolved
 * type universe at the point of use (filled via intersection), enabling
 * recursive types like `optional(optional(T))`.
 *
 * @example
 * ```typescript
 * interface MyExtension extends TypeExtensionHKT {
 *   // `this[typeof _types]` is the full type universe including all extensions
 *   provided: { kind: "myType"; inner: this[typeof _types] };
 * }
 * ```
 */
export abstract class TypeExtensionHKT {
  declare [_types]: unknown;
  abstract fn: TypeExtensionFn;
}

type ResolveExtensionType<
  Ext extends TypeExtensionHKT,
  Universe,
> = (Ext & { [_types]: Universe }) extends infer T extends TypeExtensionHKT
  ? ReturnType<T["fn"]>
  : never;

type AnyCELTypeDef =
  | CELType
  | { kind: "list"; elementType: AnyCELTypeDef }
  | { kind: "map"; keyType: CELType; valueType: AnyCELTypeDef }
  | Record<string, unknown>;

// ============================================================
// Core CEL types
// ============================================================

/**
 * Base CEL types
 */
export type CELType =
  | "bool"
  | "int"
  | "uint"
  | "double"
  | "string"
  | "bytes"
  | "list"
  | "map"
  | "dyn"
  | "null"
  | "timestamp"
  | "duration";

/**
 * CEL list type with element type
 */
export interface CELListType<Exts extends TypeExtensionHKT[] = []> {
  kind: "list";
  elementType: CELTypeDef<Exts>;
}

/**
 * CEL map type with key and value types
 */
export interface CELMapType<Exts extends TypeExtensionHKT[] = []> {
  kind: "map";
  keyType: CELType;
  valueType: CELTypeDef<Exts>;
}

/**
 * Full CEL type definition, parameterized by active extensions.
 *
 * With no extensions (`CELTypeDef<[]>`), this is equivalent to the base
 * type union. When extensions are provided, their contributed types are
 * included in the union.
 *
 * @example
 * ```typescript
 * // Base types only:
 * type Basic = CELTypeDef; // "bool" | "int" | ... | CELListType | CELMapType
 *
 * // With optional types:
 * type WithOpt = CELTypeDef<[OptionalTypesExt]>;
 * // also includes { kind: "optional"; innerType: WithOpt }
 * ```
 */
type BaseCELTypeDef<Exts extends TypeExtensionHKT[] = []> =
  | CELType
  | CELListType<Exts>
  | CELMapType<Exts>;

type ProvidedCELTypes<
  Exts extends TypeExtensionHKT[] = [],
  Universe = AnyCELTypeDef,
> = {
  [K in keyof Exts]: Exts[K] extends TypeExtensionHKT
    ? ResolveExtensionType<Exts[K], Universe>
    : never;
}[number];

export type CELTypeDef<Exts extends TypeExtensionHKT[] = []> =
  | BaseCELTypeDef<Exts>
  | ProvidedCELTypes<Exts>;

// ============================================================
// Function and variable declarations
// ============================================================

/**
 * Parameter definition for a CEL function
 */
export interface CELFunctionParam<Exts extends TypeExtensionHKT[] = []> {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: CELTypeDef<Exts>;
  /** Whether the parameter is optional */
  optional?: boolean;
}

declare const CELFunctionDefinitionBrand: unique symbol;
export type CELFunctionDefinitionBrand = typeof CELFunctionDefinitionBrand;

export interface CELFunctionDefinition {
  /** Function name (must be a valid CEL identifier) */
  name: string;
  /** Function parameters */
  params: CELFunctionParam<any>[];
  /** Return type */
  returnType: CELTypeDef<any>;
  /** Implementation function that will be called when the CEL function is invoked */
  impl: (...args: any[]) => any;
  /** Whether the function accepts variable arguments (overloads) */
  overloads?: CELFunctionDefinition[];
  /** Brand to ensure only verified builders can create definitions */
  readonly [CELFunctionDefinitionBrand]: true;
}

/**
 * Variable declaration for an environment
 */
export interface VariableDeclaration<Exts extends TypeExtensionHKT[] = []> {
  /** Variable name */
  name: string;
  /** Variable type */
  type: CELTypeDef<Exts>;
}

/**
 * Options for creating a CEL environment
 */
export interface EnvOptions<Exts extends TypeExtensionHKT[] = []> {
  /** Variable declarations (name and type) */
  variables?: VariableDeclaration<Exts>[];
  /** Custom functions to register */
  functions?: CELFunctionDefinition[];
  /** Environment options (like OptionalTypes) */
  options?: import("./options/index.js").EnvOptionInput[];
}

/**
 * Result of typechecking a CEL expression
 */
export interface TypeCheckResult {
  /** The inferred type of the expression */
  type: CELTypeDef<any>;
}

/**
 * Represents a compilation issue (error, warning, or info)
 */
export interface CompilationIssue {
  /** Severity level of the issue */
  severity: "error" | "warning" | "info";
  /** Human-readable description of the issue */
  message: string;
  /** Source location information */
  location?: {
    /** Line number (1-based) */
    line?: number;
    /** Column number (1-based) */
    column?: number;
    /** Character offset in the source */
    offset?: number;
  };
}

/**
 * Detailed result of compiling a CEL expression
 */
export interface CompilationResult {
  /** Whether compilation succeeded */
  success: boolean;
  /** Error message if compilation failed completely */
  error?: string;
  /** All issues found during compilation (errors, warnings, info) */
  issues: CompilationIssue[];
  /** The compiled program if compilation succeeded */
  program?: import("./core.js").Program;
}

// ============================================================
// Extension helpers
// ============================================================

/** Phantom brand for carrying extension type info on option values */
declare const _ext: unique symbol;
export type _ext = typeof _ext;
export declare const _envExtensions: unique symbol;
export type _envExtensions = typeof _envExtensions;

/**
 * Marker interface for env options that carry extension type info.
 * The phantom {@link _ext} field encodes which extensions an option provides.
 */
export interface TypedEnvOption<Exts extends TypeExtensionHKT[] = []> {
  readonly [_ext]?: Exts;
}

export interface EnvWithExtensions<Exts extends TypeExtensionHKT[] = []> {
  readonly [_envExtensions]?: Exts;
}

/** Flatten a tuple of extension tuples into a single extension tuple */
type Flatten<T extends readonly any[]> = T extends readonly [
  infer Head extends readonly any[],
  ...infer Rest extends readonly any[],
]
  ? [...Head, ...Flatten<Rest>]
  : [];

/**
 * Infer the combined extension tuple from an array of env options.
 *
 * @example
 * ```typescript
 * type Exts = InferExtensions<[
 *   TypedEnvOption<[OptionalTypesExt]>,
 *   TypedEnvOption<[]>,
 * ]>;
 * // Exts = [OptionalTypesExt]
 * ```
 */
export type InferExtensions<Opts extends readonly any[]> = Flatten<{
  [K in keyof Opts]: Opts[K] extends TypedEnvOption<infer E> ? E : [];
}>;

/**
 * Extract the extension tuple from an Env instance type.
 *
 * @example
 * ```typescript
 * const env = await Env.new({ options: [Options.optionalTypes()] });
 * type Exts = EnvExtensions<typeof env>; // [OptionalTypesExt]
 *
 * const fn = CELFunction.new<Exts>("wrap")
 *   .param("x", { kind: "optional", innerType: "string" })
 *   .returns("string")
 *   .implement((x) => x ?? "");
 * ```
 */
export type EnvExtensions<E> = E extends EnvWithExtensions<
  infer Exts extends TypeExtensionHKT[]
>
  ? Exts
  : [];
