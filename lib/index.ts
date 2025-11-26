// Main entry point with runtime environment detection
//
// This works for:
// 1. Bundlers: They use package.json conditional exports (preferred, tree-shakes better)
// 2. Native ES modules: Runtime detection selects the right module
//
// For best results with bundlers, they will use conditional exports.
// For native ES modules without bundlers, this file detects the environment.

// Detect environment at module load time
const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

// Import the appropriate module
// Note: This is a top-level await, which works in ES modules
const module = isBrowser
  ? await import("./browser.js")
  : await import("./node.js");

// Re-export everything
export const { Program, Env, init } = module;
export { listType, mapType, CELFunction } from "./functions.js";
export { Options } from "./options/index.js";

// Re-export types
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

export type {
  EnvOptionConfig,
  OptionalTypesConfig,
  ValidationIssue,
  ValidationContext,
  ValidatorResult,
  ASTValidatorFunction,
  ASTValidatorsConfig,
} from "./options/index.js";
