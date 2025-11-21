/**
 * CEL Environment Options
 * 
 * This file contains TypeScript definitions for configurable CEL environment options.
 */

/**
 * Interface representing the environment capabilities available to options during setup
 */
export interface OptionSetupEnvironment {
  /**
   * Get the environment ID
   */
  getID(): string;
  
  /**
   * Register a custom JavaScript function to this environment
   * @param name - The name of the function as it will appear in CEL expressions
   * @param impl - The JavaScript implementation of the function
   */
  registerFunction(name: string, impl: (...args: any[]) => any): Promise<void>;
}

/**
 * Interface for options that need to perform setup operations before being applied
 * This allows options to handle their own complex JavaScript-side operations
 */
export interface OptionWithSetup {
  /**
   * Perform any necessary setup operations (like registering JavaScript functions)
   * and return the processed option configuration ready for WASM
   * 
   * @param env - The environment instance to perform setup on
   * @returns Promise resolving to the processed option configuration
   */
  setupAndProcess(env: OptionSetupEnvironment): Promise<EnvOptionConfig>;
}

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
 * Base option configuration that gets sent to WASM
 */
export type EnvOptionConfig = {
  type: "OptionalTypes";
  options?: OptionalTypesConfig;
};

/**
 * Union type of all available option inputs (simple configs or complex options with setup)
 */
export type EnvOptionInput = EnvOptionConfig | OptionWithSetup;

/**
 * Available option types
 */
export type OptionType = "OptionalTypes";


/**
 * Helper functions for creating option configurations
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
  optionalTypes(): EnvOptionConfig {
    return {
      type: "OptionalTypes",
      options: {},
    };
  },

} as const;