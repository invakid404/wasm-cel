/**
 * CrossTypeNumericComparisons CEL environment option
 */

import type { EnvOptionConfig } from "./base.js";

/**
 * Configuration for CrossTypeNumericComparisons CEL environment option
 *
 * CrossTypeNumericComparisons makes it possible to compare across numeric types
 * using ordering operators, e.g. double < int. This enables cross-type numeric
 * comparisons for ordering operations in CEL expressions.
 *
 * Note: This only enables ordering operators (<, <=, >, >=), not equality operators (==, !=).
 *
 * When enabled, you can write expressions like:
 * - `3.14 > 3` (double > int)
 * - `42 >= 42.0` (int >= double)
 * - `1.5 <= 2` (double <= int)
 */
export interface CrossTypeNumericComparisonsConfig {
  /**
   * Whether to enable cross-type numeric comparisons.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Create a CrossTypeNumericComparisons option configuration
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
 * // Now you can use cross-type comparisons:
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
export function crossTypeNumericComparisons(
  config: CrossTypeNumericComparisonsConfig = {},
): EnvOptionConfig {
  return {
    type: "CrossTypeNumericComparisons",
    params: {
      enabled: config.enabled ?? true,
    },
  };
}
