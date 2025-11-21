/**
 * CEL type system definitions
 * These types correspond to CEL's type system and will be used for type checking
 */

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
export interface CELListType {
  kind: "list";
  elementType: CELType | CELListType | CELMapType;
}

/**
 * CEL map type with key and value types
 */
export interface CELMapType {
  kind: "map";
  keyType: CELType;
  valueType: CELType | CELListType | CELMapType;
}

/**
 * Union of all possible CEL type representations
 */
export type CELTypeDef = CELType | CELListType | CELMapType;

/**
 * Parameter definition for a CEL function
 */
export interface CELFunctionParam {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: CELTypeDef;
  /** Whether the parameter is optional */
  optional?: boolean;
}

/**
 * Definition of a custom CEL function
 */
export interface CELFunctionDefinition {
  /** Function name (must be a valid CEL identifier) */
  name: string;
  /** Function parameters */
  params: CELFunctionParam[];
  /** Return type */
  returnType: CELTypeDef;
  /** Implementation function that will be called when the CEL function is invoked */
  impl: (...args: any[]) => any;
  /** Whether the function accepts variable arguments (overloads) */
  overloads?: CELFunctionDefinition[];
}

/**
 * Variable declaration for an environment
 */
export interface VariableDeclaration {
  /** Variable name */
  name: string;
  /** Variable type */
  type: CELTypeDef;
}

/**
 * Options for creating a CEL environment
 */
export interface EnvOptions {
  /** Variable declarations (name and type) */
  variables?: VariableDeclaration[];
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
  type: CELTypeDef;
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
  program?: import("./index.js").Program;
}
