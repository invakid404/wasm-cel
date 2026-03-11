/**
 * MathExt CEL environment option
 */

import type { EnvOptionConfig } from "./base.js";

/**
 * Configuration for the CEL math extension library.
 *
 * Enables namespaced math helper macros and functions including:
 * - `math.greatest`, `math.least` - min/max across arguments or lists
 * - `math.ceil`, `math.floor`, `math.round`, `math.trunc` (v1+) - rounding
 * - `math.abs`, `math.sign` (v1+) - absolute value and sign
 * - `math.isNaN`, `math.isInf`, `math.isFinite` (v1+) - floating point checks
 * - `math.bitAnd`, `math.bitOr`, `math.bitXor`, `math.bitNot` (v1+) - bitwise ops
 * - `math.bitShiftLeft`, `math.bitShiftRight` (v1+) - bit shifting
 * - `math.sqrt` (v2+) - square root
 */
export interface MathExtConfig {
  /**
   * The version of the math extension library to enable.
   * Only functions introduced at or below the given version are included.
   * If not set, all functions are available.
   *
   * - Version 0: math.greatest, math.least
   * - Version 1: adds ceil, floor, round, trunc, abs, sign, isNaN, isInf, isFinite, bitwise ops
   * - Version 2: adds sqrt
   */
  version?: number;
}

/**
 * Create a MathExt option configuration to enable the CEL math extension library.
 *
 * @param config - Optional configuration for the math extension
 * @returns An option configuration for enabling CEL math extensions
 *
 * @example
 * ```typescript
 * // Enable all math extension functions
 * const env = await Env.new({
 *   options: [Options.math()]
 * });
 *
 * const program = await env.compile("math.greatest(1, 2, 3)");
 * const result = await program.eval(); // 3
 * ```
 *
 * @example
 * ```typescript
 * // Enable with specific version
 * const env = await Env.new({
 *   options: [Options.math({ version: 1 })]
 * });
 *
 * // Now ceil/floor/round etc. are available
 * const program = await env.compile("math.ceil(1.2)");
 * const result = await program.eval(); // 2.0
 * ```
 */
export function math(config: MathExtConfig = {}): EnvOptionConfig {
  const params: Record<string, unknown> = {};

  if (config.version !== undefined) {
    params.version = config.version;
  }

  return {
    type: "MathExt",
    params,
  };
}
