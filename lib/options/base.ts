/**
 * Base types and interfaces for CEL environment options
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
   * @returns Promise resolving to the actual implementation ID that was registered
   */
  registerFunction(name: string, impl: (...args: any[]) => any): Promise<string>;
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
 * Base option configuration that gets sent to WASM
 */
export type EnvOptionConfig = 
  | {
      type: "OptionalTypes";
      params?: import("./optionalTypes.js").OptionalTypesConfig;
    }
  | {
      type: "ASTValidators";
      params?: import("./astValidators.js").ASTValidatorsInternalConfig;
    };

/**
 * Union type of all available option inputs (simple configs or complex options with setup)
 */
export type EnvOptionInput = EnvOptionConfig | OptionWithSetup;

/**
 * Available option types
 */
export type OptionType = "OptionalTypes" | "ASTValidators";