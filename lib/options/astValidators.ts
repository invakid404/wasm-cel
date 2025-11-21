/**
 * ASTValidators CEL environment option
 */

import type { OptionSetupEnvironment, OptionWithSetup, EnvOptionConfig } from "./base.js";

/**
 * Represents an issue found during AST validation
 */
export interface ValidationIssue {
  /** The severity of the issue */
  severity: "error" | "warning" | "info";
  /** Human-readable description of the issue */
  message: string;
  /** Optional location information */
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
 * Context provided to validator functions during AST validation
 */
export interface ValidationContext {
  /** The source expression being validated */
  readonly source: string;
  /** Additional context data */
  readonly contextData: Record<string, any>;
}

/**
 * Result returned by AST validator functions
 */
export interface ValidatorResult {
  /** Issues found during validation */
  issues?: ValidationIssue[];
}

/**
 * A user-defined AST validator function
 * 
 * This function will be called during AST validation with information about
 * the current expression node being visited. The function should examine
 * the node and return any validation issues found.
 * 
 * @param nodeType - The type of AST node being visited
 * @param nodeData - Data about the current node  
 * @param context - Validation context with source and additional data
 * @returns Validation result with any issues found, or undefined if no issues
 */
export type ASTValidatorFunction = (
  nodeType: string,
  nodeData: Record<string, any>,
  context: ValidationContext
) => ValidatorResult | undefined;

/**
 * Configuration for ASTValidators CEL environment option
 * 
 * ASTValidators allow you to define custom validation rules that are applied
 * during CEL expression compilation. Each validator is implemented as an
 * ExprVisitor that examines AST nodes and reports validation issues.
 */
export interface ASTValidatorsConfig {
  /** Array of validator functions to register */
  validators: ASTValidatorFunction[];
  /** Optional configuration for the validators */
  options?: {
    /** Whether to fail compilation on validation warnings (default: true). Errors always cause compilation failure. */
    failOnWarning?: boolean;
    /** Whether to include warnings in the validation results (default: true) */
    includeWarnings?: boolean;
  };
}

/**
 * Internal configuration structure for AST validators after function registration.
 * This is what gets sent to the WASM layer.
 * @internal
 */
export interface ASTValidatorsInternalConfig {
  /** Internal validator function IDs registered with the environment */
  validatorFunctionIds: string[];
  /** Configuration options */
  failOnWarning?: boolean;
  includeWarnings?: boolean;
}

/**
 * Create an ASTValidators option configuration
 * 
 * This option allows you to define custom validation rules that are applied
 * during CEL expression compilation. Each validator function will be called
 * for each AST node during compilation, allowing you to implement custom
 * validation logic.
 * 
 * @param config - Configuration for the AST validators
 * @returns An option configuration that implements OptionWithSetup
 * 
 * @example
 * ```typescript
 * const env = await Env.new({
 *   variables: [{ name: "user", type: { kind: "map", keyType: "string", valueType: "string" } }],
 *   options: [
 *     Options.astValidators({
 *       validators: [
 *         // Validator that warns about accessing potentially unsafe fields
 *         (nodeType, nodeData, context) => {
 *           if (nodeType === "select" && nodeData.field === "password") {
 *             return {
 *               issues: [{
 *                 severity: "warning",
 *                 message: "Accessing password field may not be secure"
 *               }]
 *             };
 *           }
 *         },
 *         // Validator that prevents certain function calls
 *         (nodeType, nodeData, context) => {
 *           if (nodeType === "call" && nodeData.function === "dangerousFunction") {
 *             return {
 *               issues: [{
 *                 severity: "error", 
 *                 message: "Use of dangerousFunction is not allowed"
 *               }]
 *             };
 *           }
 *         }
 *       ],
       *       options: {
       *         failOnWarning: true,
       *         includeWarnings: true
       *       }
 *     })
 *   ]
 * });
 * ```
 */
export function astValidators(config: ASTValidatorsConfig): OptionWithSetup {
  return {
    async setupAndProcess(env: OptionSetupEnvironment): Promise<EnvOptionConfig> {
      // Register each validator function with the environment
      const validatorFunctionIds: string[] = [];
      
      for (let i = 0; i < config.validators.length; i++) {
        const validator = config.validators[i];
        const baseName = `__ast_validator_${i}`;
        
        // Register the validator function and get the actual implementation ID
        const actualImplId = await env.registerFunction(baseName, validator);
        validatorFunctionIds.push(actualImplId);
      }

      return {
        type: "ASTValidators",
        params: {
          validatorFunctionIds,
          failOnWarning: config.options?.failOnWarning ?? true,
          includeWarnings: config.options?.includeWarnings ?? true,
        } satisfies ASTValidatorsInternalConfig,
      };
    },
  };
}