/**
 * Global type declarations for Go WASM integration
 */

// Type aliases for reusable types
type EvaluateCELFunction = (
  expr: string,
  vars: Record<string, any>,
) => {
  result?: any;
  error?: string;
};

type GoConstructor = {
  new (): {
    importObject: WebAssembly.Imports;
    run: (instance: WebAssembly.Instance) => void;
  };
};

declare global {
  interface Window {
    Go: typeof Go;
    evaluateCEL: EvaluateCELFunction;
  }

  var Go: GoConstructor;
  var evaluateCEL: EvaluateCELFunction;
}

export {};
