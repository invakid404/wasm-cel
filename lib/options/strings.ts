/**
 * StringsExt CEL environment option
 */

import type { EnvOptionConfig } from "./base.js";

/**
 * Configuration for the CEL string extension library.
 *
 * Enables additional string manipulation functions including:
 * - `charAt`, `indexOf`, `lastIndexOf` - character/substring searching
 * - `join` - list-to-string joining
 * - `lowerAscii`, `upperAscii` - ASCII case conversion
 * - `replace` - substring replacement
 * - `split` - string splitting
 * - `substring` - substring extraction
 * - `trim` - whitespace trimming
 * - `format` (v1+) - printf-style string formatting
 * - `quote` (v1+) - safe string quoting
 * - `reverse` (v3+) - string reversal
 */
export interface StringsExtConfig {
  /**
   * The version of the string extension library to enable.
   * Only functions introduced at or below the given version are included.
   * If not set, all functions are available.
   *
   * - Version 0: charAt, indexOf, join, lastIndexOf, lowerAscii, replace, split, substring, trim, upperAscii
   * - Version 1: adds format, quote
   * - Version 3: adds reverse
   */
  version?: number;

  /**
   * The locale to use for locale-sensitive string operations.
   */
  locale?: string;

  /**
   * Whether to validate format calls at compile time.
   * When enabled, format string arguments are checked for correctness during compilation.
   */
  validateFormatCalls?: boolean;
}

/**
 * Create a StringsExt option configuration to enable the CEL string extension library.
 *
 * @param config - Optional configuration for the string extension
 * @returns An option configuration for enabling CEL string extensions
 *
 * @example
 * ```typescript
 * // Enable all string extension functions
 * const env = await Env.new({
 *   options: [Options.strings()]
 * });
 *
 * const program = await env.compile("'hello world'.upperAscii()");
 * const result = await program.eval(); // "HELLO WORLD"
 * ```
 *
 * @example
 * ```typescript
 * // Enable with specific version
 * const env = await Env.new({
 *   options: [Options.strings({ version: 1 })]
 * });
 *
 * // Now format is available (v1+)
 * const program = await env.compile("'Hello %s, you are %d'.format(['World', 42])");
 * ```
 */
export function strings(config: StringsExtConfig = {}): EnvOptionConfig {
  const params: Record<string, unknown> = {};

  if (config.version !== undefined) {
    params.version = config.version;
  }
  if (config.locale !== undefined) {
    params.locale = config.locale;
  }
  if (config.validateFormatCalls !== undefined) {
    params.validateFormatCalls = config.validateFormatCalls;
  }

  return {
    type: "StringsExt",
    params,
  };
}
