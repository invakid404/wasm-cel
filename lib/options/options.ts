/**
 * Helper functions for creating option configurations
 */

import { optionalTypes } from "./optionalTypes.js";
import { astValidators } from "./astValidators.js";
import { crossTypeNumericComparisons } from "./crossTypeNumericComparisons.js";

/**
 * Helper object containing functions for creating CEL environment option configurations
 */
export const Options = {
  /**
   * Create an OptionalTypes option configuration
   * 
   * @example
   * ```typescript
   * const env = await Env.new({
   *   variables: [{ name: "x", type: "int" }],
   *   options: [Options.optionalTypes()]
   * });
   * ```
   */
  optionalTypes,

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
   *             context.addIssue({
   *               severity: "warning",
   *               message: "Accessing password field may not be secure"
   *             });
   *           }
   *         },
   *         // Validator that prevents certain function calls
   *         (nodeType, nodeData, context) => {
   *           if (nodeType === "call" && nodeData.function === "dangerousFunction") {
   *             context.addIssue({
   *               severity: "error", 
   *               message: "Use of dangerousFunction is not allowed"
   *             });
   *           }
   *         }
   *       ],
   *       options: {
   *         failOnError: true,
   *         includeWarnings: true
   *       }
   *     })
   *   ]
   * });
   * ```
   */
  astValidators,

  /**
   * Create a CrossTypeNumericComparisons option configuration
   * 
   * This option enables cross-type numeric comparisons for ordering operators
   * in CEL expressions, allowing you to compare values of different numeric types
   * using <, <=, >, >= operators (but not == or !=).
   * 
   * @param config - Configuration for cross-type numeric comparisons
   * @returns An option configuration for enabling cross-type numeric comparisons
   * 
   * @example
   * ```typescript
   * const env = await Env.new({
   *   variables: [
   *     { name: "doubleValue", type: "double" },
   *     { name: "intValue", type: "int" }
   *   ],
   *   options: [Options.crossTypeNumericComparisons()]
   * });
   * 
   * // Now you can use cross-type ordering comparisons:
   * const program = env.compile("doubleValue > intValue");
   * ```
   * 
   * @example
   * ```typescript
   * // Explicitly disable cross-type comparisons
   * const env = await Env.new({
   *   variables: [{ name: "x", type: "int" }],
   *   options: [Options.crossTypeNumericComparisons({ enabled: false })]
   * });
   * ```
   */
  crossTypeNumericComparisons,

} as const;