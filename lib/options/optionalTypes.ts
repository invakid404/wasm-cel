/**
 * OptionalTypes CEL environment option
 */

import type { EnvOptionConfig } from "./base.js";

/**
 * Configuration for OptionalTypes CEL environment option
 *
 * OptionalTypes enable support for optional syntax and types in CEL.
 * This includes optional field access (obj.?field), optional indexing (list[?0]),
 * and optional value creation (optional.of(value)).
 *
 * This option takes no configuration parameters - it's simply enabled or disabled.
 */
export interface OptionalTypesConfig {
  // No configuration needed - OptionalTypes is simply enabled when used
}

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
export function optionalTypes(): EnvOptionConfig {
  return {
    type: "OptionalTypes",
    params: {},
  };
}
