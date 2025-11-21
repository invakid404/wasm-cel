/**
 * CEL Environment Options
 *
 * This module contains TypeScript definitions for configurable CEL environment options.
 */

// Re-export base types and interfaces
export type {
  OptionSetupEnvironment,
  OptionWithSetup,
  EnvOptionConfig,
  EnvOptionInput,
  OptionType,
} from "./base.js";

// Re-export specific option types
export type { OptionalTypesConfig } from "./optionalTypes.js";
export type {
  ValidationIssue,
  ValidationContext,
  ValidatorResult,
  ASTValidatorFunction,
  ASTValidatorsConfig,
} from "./astValidators.js";
export type { CrossTypeNumericComparisonsConfig } from "./crossTypeNumericComparisons.js";

// Re-export the Options helper object
export { Options } from "./options.js";
