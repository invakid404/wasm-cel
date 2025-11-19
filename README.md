# wasm-cel

WebAssembly module for evaluating CEL (Common Expression Language) expressions
in Node.js.

## Installation

```bash
npm install wasm-cel
# or
pnpm add wasm-cel
# or
yarn add wasm-cel
```

## Usage

The library follows the CEL pattern: create an environment, compile an
expression, and then evaluate it:

```typescript
import { Env } from "wasm-cel";

// Create an environment with variable declarations
const env = await Env.new({
  variables: [
    { name: "x", type: "double" },
    { name: "y", type: "double" },
    { name: "name", type: "string" },
    { name: "age", type: "double" },
  ],
});

// Compile an expression
const program = await env.compile("x + y");

// Evaluate with variables
const result = await program.eval({ x: 10, y: 20 });
console.log(result); // 30

// You can reuse the same program with different variables
const result2 = await program.eval({ x: 5, y: 15 });
console.log(result2); // 20

// Compile and evaluate multiple expressions with the same environment
const program2 = await env.compile(
  'name + " is " + string(age) + " years old"',
);
const result3 = await program2.eval({ name: "Alice", age: 30 });
console.log(result3); // "Alice is 30 years old"
```

## API

### `Env.new(options?: EnvOptions): Promise<Env>`

Creates a new CEL environment with variable declarations and optional function
definitions.

**Parameters:**

- `options` (EnvOptions, optional): Options including:
  - `variables` (VariableDeclaration[], optional): Array of variable
    declarations with name and type
  - `functions` (CELFunctionDefinition[], optional): Array of custom function
    definitions

**Returns:**

- `Promise<Env>`: A promise that resolves to a new Env instance

**Example:**

```typescript
const env = await Env.new({
  variables: [
    { name: "x", type: "int" },
    { name: "y", type: "string" },
  ],
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
const program = await env.compile("x + 10");
```

### `env.typecheck(expr: string): Promise<TypeCheckResult>`

Typechecks a CEL expression in the environment without compiling it. This is
useful for validating expressions and getting type information before
compilation.

**Parameters:**

- `expr` (string): The CEL expression to typecheck

**Returns:**

- `Promise<TypeCheckResult>`: A promise that resolves to type information with a
  `type` property containing the inferred type

**Example:**

```typescript
const env = await Env.new({
  variables: [
    { name: "x", type: "int" },
    { name: "y", type: "int" },
  ],
});

// Typecheck a simple expression
const typeInfo = await env.typecheck("x + y");
console.log(typeInfo.type); // "int"

// Typecheck a list expression
const listType = await env.typecheck("[1, 2, 3]");
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

- `vars` (Record<string, any> | null, optional): Variables to use in the
  evaluation. Defaults to `null`.

**Returns:**

- `Promise<any>`: A promise that resolves to the evaluation result

**Example:**

```typescript
const result = await program.eval({ x: 5 });
```

### `env.destroy(): void`

Destroys the environment and marks it as destroyed. After calling `destroy()`,
you cannot create new programs or typecheck expressions with this environment.
However, programs that were already created from this environment will continue
to work until they are destroyed themselves.

**Note:** This method is idempotent - calling it multiple times is safe and has
no effect after the first call.

**Example:**

```typescript
const env = await Env.new();
const program = await env.compile("10 + 20");

// Destroy the environment
env.destroy();

// This will throw an error
await expect(env.compile("5 + 5")).rejects.toThrow();

// But existing programs still work
const result = await program.eval();
console.log(result); // 30
```

### `program.destroy(): void`

Destroys the compiled program and frees associated WASM resources. After calling
`destroy()`, you cannot evaluate the program anymore.

**Note:** This method is idempotent - calling it multiple times is safe and has
no effect after the first call.

**Example:**

```typescript
const program = await env.compile("10 + 20");
program.destroy();

// This will throw an error
await expect(program.eval()).rejects.toThrow();
```

### `init(): Promise<void>`

Initializes the WASM module. This is called automatically by the API functions,
but can be called manually to pre-initialize the module.

## Memory Management

This library implements comprehensive memory leak prevention mechanisms to
ensure WASM resources are properly cleaned up.

### Explicit Cleanup

Both `Env` and `Program` instances provide a `destroy()` method for explicit
cleanup:

```typescript
const env = await Env.new();
const program = await env.compile("x + y");

// When done, explicitly destroy resources
program.destroy();
env.destroy();
```

### Automatic Cleanup with FinalizationRegistry

The library uses JavaScript's `FinalizationRegistry` (available in Node.js 14+)
to automatically clean up resources when objects are garbage collected. This
provides a **best-effort** safety net in case you forget to call `destroy()`.

**Important limitations:**

- FinalizationRegistry callbacks are not guaranteed to run immediately or at all
- They may run long after an object is garbage collected, or not at all in some
  cases
- The timing is non-deterministic and depends on the JavaScript engine's garbage
  collector

**Best practice:** Always explicitly call `destroy()` when you're done with an
environment or program. Don't rely solely on automatic cleanup.

### Reference Counting for Custom Functions

The library uses reference counting to manage custom JavaScript functions
registered with environments:

1. **When a program is created** from an environment, reference counts are
   incremented for all custom functions in that environment
2. **When a program is destroyed**, reference counts are decremented
3. **Functions are only unregistered** when their reference count reaches zero

This means:

- **Programs continue to work** even after their parent environment is destroyed
- **Functions remain available** as long as any program that might use them
  still exists
- **Functions are automatically cleaned up** when all programs using them are
  destroyed

**Example:**

```typescript
const add = CELFunction.new("add")
  .param("a", "int")
  .param("b", "int")
  .returns("int")
  .implement((a, b) => a + b);

const env = await Env.new({ functions: [add] });
const program = await env.compile("add(10, 20)");

// Destroy the environment - functions are still available
env.destroy();

// Program still works because functions are reference counted
const result = await program.eval();
console.log(result); // 30

// When program is destroyed, functions are cleaned up
program.destroy();
```

### Environment Lifecycle

- **Destroyed environments** cannot create new programs or typecheck expressions
- **Existing programs** from a destroyed environment continue to work
- **The environment entry** is cleaned up when all programs using it are
  destroyed

### Best Practices

1. **Always call `destroy()`** when you're done with environments and programs
2. **Destroy programs before environments** if you want to ensure functions are
   cleaned up immediately
3. **Don't rely on automatic cleanup** - it's a safety net, not a guarantee
4. **In long-running applications**, explicitly manage the lifecycle of
   resources to prevent memory leaks

## TypeScript Support

This package includes TypeScript type definitions. Import types as needed:

```typescript
import {
  Env,
  Program,
  EnvOptions,
  VariableDeclaration,
  TypeCheckResult,
} from "wasm-cel";
```

## Building from Source

To build the package from source, you'll need:

- Go 1.21 or later
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

This is an **ESM-only** package. It uses modern ES modules and NodeNext module
resolution. If you're using TypeScript, make sure your `tsconfig.json` has
`"module": "NodeNext"` or `"moduleResolution": "NodeNext"` for proper type
resolution.

## License

MIT
