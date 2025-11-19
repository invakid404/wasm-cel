/**
 * Global type declarations for Go WASM integration
 */

// Type aliases for reusable types
type RegisterCELFunction = (
  implID: string,
  fn: (...args: any[]) => any,
) => {
  success?: boolean;
  error?: string;
};

type CreateEnvFunction = (
  varDecls: Array<{ name: string; type: any }>,
  funcDefs?: any,
) => {
  envID?: string;
  error?: string;
};

type CompileExprFunction = (
  envID: string,
  expr: string,
) => {
  programID?: string;
  error?: string;
};

type EvalProgramFunction = (
  programID: string,
  vars: Record<string, any>,
) => {
  result?: any;
  error?: string;
};

type TypecheckExprFunction = (
  envID: string,
  expr: string,
) => {
  type?: any;
  error?: string;
};

type DestroyEnvFunction = (envID: string) => {
  success?: boolean;
  error?: string;
};

type DestroyProgramFunction = (programID: string) => {
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
    registerCELFunction: RegisterCELFunction;
    createEnv: CreateEnvFunction;
    compileExpr: CompileExprFunction;
    typecheckExpr: TypecheckExprFunction;
    evalProgram: EvalProgramFunction;
    destroyEnv: DestroyEnvFunction;
    destroyProgram: DestroyProgramFunction;
  }

  var Go: GoConstructor;
  var registerCELFunction: RegisterCELFunction;
  var createEnv: CreateEnvFunction;
  var compileExpr: CompileExprFunction;
  var typecheckExpr: TypecheckExprFunction;
  var evalProgram: EvalProgramFunction;
  var destroyEnv: DestroyEnvFunction;
  var destroyProgram: DestroyProgramFunction;
}

export {};
