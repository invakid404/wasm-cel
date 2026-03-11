/**
 * EncodersExt CEL environment option
 */

import type { EnvOptionConfig } from "./base.js";

/**
 * Configuration for the CEL encoders extension library.
 *
 * Enables encoding/decoding functions including:
 * - `base64.encode` - encodes bytes to a base64-encoded string
 * - `base64.decode` - decodes a base64-encoded string to bytes
 */
export interface EncodersExtConfig {
  /**
   * The version of the encoders extension library to enable.
   * Only functions introduced at or below the given version are included.
   * If not set, all functions are available.
   */
  version?: number;
}

/**
 * Create an EncodersExt option configuration to enable the CEL encoders extension library.
 *
 * @param config - Optional configuration for the encoders extension
 * @returns An option configuration for enabling CEL encoder extensions
 *
 * @example
 * ```typescript
 * // Enable all encoder extension functions
 * const env = await Env.new({
 *   options: [Options.encoders()]
 * });
 *
 * const program = await env.compile("base64.encode(b'hello')");
 * const result = await program.eval(); // "aGVsbG8="
 * ```
 */
export function encoders(config: EncodersExtConfig = {}): EnvOptionConfig {
  const params: Record<string, unknown> = {};

  if (config.version !== undefined) {
    params.version = config.version;
  }

  return {
    type: "EncodersExt",
    params,
  };
}
