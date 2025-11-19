# wasm-cel

WebAssembly module for evaluating CEL (Common Expression Language) expressions in Node.js.

## Installation

```bash
npm install wasm-cel
# or
pnpm add wasm-cel
# or
yarn add wasm-cel
```

## Usage

The library follows the CEL pattern: create an environment, compile an expression, and then evaluate it:

```typescript
import { Env } from 'wasm-cel';

// Create an environment with variable declarations
const env = await Env.new({
  variables: [
    { name: 'x', type: 'double' },
    { name: 'y', type: 'double' },
    { name: 'name', type: 'string' },
    { name: 'age', type: 'double' }
  ]
});

// Compile an expression
const program = await env.compile('x + y');

// Evaluate with variables
const result = await program.eval({ x: 10, y: 20 });
console.log(result); // 30

// You can reuse the same program with different variables
const result2 = await program.eval({ x: 5, y: 15 });
console.log(result2); // 20

// Compile and evaluate multiple expressions with the same environment
const program2 = await env.compile('name + " is " + string(age) + " years old"');
const result3 = await program2.eval({ name: 'Alice', age: 30 });
console.log(result3); // "Alice is 30 years old"
```

## API

### `Env.new(options?: EnvOptions): Promise<Env>`

Creates a new CEL environment with variable declarations and optional function definitions.

**Parameters:**
- `options` (EnvOptions, optional): Options including:
  - `variables` (VariableDeclaration[], optional): Array of variable declarations with name and type
  - `functions` (CELFunctionDefinition[], optional): Array of custom function definitions

**Returns:**
- `Promise<Env>`: A promise that resolves to a new Env instance

**Example:**
```typescript
const env = await Env.new({
  variables: [
    { name: 'x', type: 'int' },
    { name: 'y', type: 'string' }
  ]
});
```

### `env.compile(expr: string): Promise<Program>`

Compiles a CEL expression in the environment.

**Parameters:**
- `expr` (string): The CEL expression to compile

**Returns:**
- `Promise<Program>`: A promise that resolves to a compiled Program

**Example:**
```typescript
const program = await env.compile('x + 10');
```

### `env.typecheck(expr: string): Promise<TypeCheckResult>`

Typechecks a CEL expression in the environment without compiling it. This is useful for validating expressions and getting type information before compilation.

**Parameters:**
- `expr` (string): The CEL expression to typecheck

**Returns:**
- `Promise<TypeCheckResult>`: A promise that resolves to type information with a `type` property containing the inferred type

**Example:**
```typescript
const env = await Env.new({
  variables: [
    { name: 'x', type: 'int' },
    { name: 'y', type: 'int' }
  ]
});

// Typecheck a simple expression
const typeInfo = await env.typecheck('x + y');
console.log(typeInfo.type); // "int"

// Typecheck a list expression
const listType = await env.typecheck('[1, 2, 3]');
console.log(listType.type); // { kind: "list", elementType: "int" }

// Typecheck a map expression
const mapType = await env.typecheck('{"key": "value"}');
console.log(mapType.type); // { kind: "map", keyType: "string", valueType: "string" }

// Typechecking will throw an error for invalid expressions
try {
  await env.typecheck('x + "invalid"'); // Type mismatch
} catch (error) {
  console.error(error.message); // Typecheck error message
}
```

### `program.eval(vars?: Record<string, any> | null): Promise<any>`

Evaluates the compiled program with the given variables.

**Parameters:**
- `vars` (Record<string, any> | null, optional): Variables to use in the evaluation. Defaults to `null`.

**Returns:**
- `Promise<any>`: A promise that resolves to the evaluation result

**Example:**
```typescript
const result = await program.eval({ x: 5 });
```

### `init(): Promise<void>`

Initializes the WASM module. This is called automatically by the API functions, but can be called manually to pre-initialize the module.

## TypeScript Support

This package includes TypeScript type definitions. Import types as needed:

```typescript
import { Env, Program, EnvOptions, VariableDeclaration, TypeCheckResult } from 'wasm-cel';
```

## Building from Source

To build the package from source, you'll need:

- Go 1.16 or later
- Node.js 18 or later
- pnpm (or npm/yarn)

```bash
# Install dependencies
pnpm install

# Build the WASM module and TypeScript
pnpm run build:all

# Run tests
pnpm test

# Run example
pnpm run example
```

## Requirements

- Node.js >= 18.0.0

## Package Type

This is an **ESM-only** package. It uses modern ES modules and NodeNext module resolution. If you're using TypeScript, make sure your `tsconfig.json` has `"module": "NodeNext"` or `"moduleResolution": "NodeNext"` for proper type resolution.

## License

MIT
