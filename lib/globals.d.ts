/**
 * Global type declarations for Go WASM integration
 */

// Type aliases for reusable types
type EvaluateCELFunction = (
  expr: string,
  vars: Record<string, any>,
  funcDefs?: any,
) => {
  result?: any;
  error?: string;
};

type RegisterCELFunction = (
  implID: string,
  fn: (...args: any[]) => any,
) => {
  success?: boolean;
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
    registerCELFunction: RegisterCELFunction;
  }

  var Go: GoConstructor;
  var evaluateCEL: EvaluateCELFunction;
  var registerCELFunction: RegisterCELFunction;
}

export {};
