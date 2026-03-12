# wasm-cel

WebAssembly module for evaluating CEL (Common Expression Language) expressions
in Node.js and browsers.

## Installation

```bash
npm install wasm-cel
# or
pnpm add wasm-cel
# or
yarn add wasm-cel
```

## Usage

### Node.js

In Node.js, the library automatically loads the WASM module. Just import and
use:

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

### Browser

In browsers, you need to initialize the WASM module first by providing the WASM
bytes or URL.

#### With Vite (Recommended)

Vite can process and optimize the WASM file automatically:

```typescript
import { init, Env } from "wasm-cel";
import wasmUrl from "wasm-cel/main.wasm?url";

// Initialize with Vite-processed WASM URL
await init(wasmUrl);

// Now use the library normally
const env = await Env.new({
  variables: [{ name: "x", type: "int" }],
});

const program = await env.compile("x + 10");
const result = await program.eval({ x: 5 });
console.log(result); // 15
```

**Loading wasm_exec.js with Vite:**

If you need to load `wasm_exec.js` dynamically (it's usually loaded via script
tag):

```typescript
import { init, Env } from "wasm-cel";
import wasmUrl from "wasm-cel/main.wasm?url";
import wasmExecUrl from "wasm-cel/wasm_exec.js?url";

// Initialize with both WASM and wasm_exec URLs
await init(wasmUrl, wasmExecUrl);

// Use the library
const env = await Env.new({ variables: [{ name: "x", type: "int" }] });
```

#### Without a Bundler (Native ES Modules)

For native ES modules without a bundler, you can import directly:

```html
<script type="module">
  import { init, Env } from "./node_modules/wasm-cel/dist/browser.js";

  // Initialize with WASM URL
  await init("/path/to/main.wasm");

  // Or load wasm_exec.js first via script tag, then just init with WASM
  await init("/path/to/main.wasm");

  // Use the library
  const env = await Env.new({ variables: [{ name: "x", type: "int" }] });
</script>
```

**Loading wasm_exec.js:**

You can either:

1. Load it via script tag before initializing:

   ```html
   <script src="/path/to/wasm_exec.js"></script>
   <script type="module">
     import { init, Env } from "./node_modules/wasm-cel/dist/browser.js";
     await init("/path/to/main.wasm");
   </script>
   ```

2. Or pass the URL to `init()`:
   ```typescript
   await init("/path/to/main.wasm", "/path/to/wasm_exec.js");
   ```

#### Other Browser Patterns

```typescript
import { init, Env } from "wasm-cel";

// Using a URL string
await init("/path/to/main.wasm");

// Using a URL object
await init(new URL("/main.wasm", window.location.origin));

// Using direct bytes (Uint8Array)
const response = await fetch("/main.wasm");
const bytes = new Uint8Array(await response.arrayBuffer());
await init(bytes);

// Using Response object
const response = await fetch("/main.wasm");
await init(response);
```

### Available Exports

The package exports the following for direct imports:

- `wasm-cel` - Main entry point (auto-selects Node.js or browser)
- `wasm-cel/browser` - Browser-specific entry point
- `wasm-cel/main.wasm` - WASM module file
- `wasm-cel/wasm_exec.js` - Go WASM runtime (for browsers)
- `wasm-cel/wasm_exec.cjs` - Go WASM runtime (CommonJS, for Node.js)

## CEL Environment Options

The library supports configurable CEL environment options to enable additional
CEL features. Options can be provided during environment creation or added later
using the `extend()` method.

### Available Options

#### OptionalTypes

Enables support for optional syntax and types in CEL, including optional field
access (`obj.?field`), optional indexing (`list[?0]`), and optional value
creation (`optional.of(value)`).

```typescript
import { Env, Options } from "wasm-cel";

const env = await Env.new({
  variables: [
    {
      name: "data",
      type: { kind: "map", keyType: "string", valueType: "string" },
    },
  ],
  options: [Options.optionalTypes()],
});

const program = await env.compile('data.?name.orValue("Anonymous")');
const result = await program.eval({ data: {} });
console.log(result); // "Anonymous"
```

#### ASTValidators

Enables custom validation rules during CEL expression compilation. Validators
can report errors, warnings, or info messages that are collected during
compilation and can prevent compilation or provide detailed feedback.

**Location Information**: Each AST node provides accurate location information
through `nodeData.location` with `line` and `column` properties, enabling
precise error reporting.

```typescript
import { Env, Options } from "wasm-cel";

const env = await Env.new({
  variables: [
    {
      name: "user",
      type: { kind: "map", keyType: "string", valueType: "string" },
    },
  ],
  options: [
    Options.astValidators({
      validators: [
        // Validator that warns about accessing potentially unsafe fields
        (nodeType, nodeData, context) => {
          if (nodeType === "select" && nodeData.field === "password") {
            return {
              issues: [
                {
                  severity: "warning",
                  message: "Accessing password field may not be secure",
                  location: nodeData.location, // Precise location from AST
                },
              ],
            };
          }
        },
        // Validator that prevents certain function calls
        (nodeType, nodeData, context) => {
          if (
            nodeType === "call" &&
            nodeData.function === "dangerousFunction"
          ) {
            return {
              issues: [
                {
                  severity: "error",
                  message: "Use of dangerousFunction is not allowed",
                  location: nodeData.location, // Precise location from AST
                },
              ],
            };
          }
        },
      ],
      options: {
        failOnWarning: false, // Don't fail compilation on warnings
        includeWarnings: true, // Include warnings in results
      },
    }),
  ],
});

// Use compileDetailed() to see validation issues
const result = await env.compileDetailed("user.password");
if (result.success) {
  console.log("Compiled with issues:", result.issues);
  // Example issue: { severity: "warning", message: "...", location: { line: 1, column: 5 } }
  const evalResult = await result.program.eval({
    user: { password: "secret" },
  });
} else {
  console.log("Compilation failed:", result.error);
}
```

**Available Node Types and Data:**

- **`select`**: Field access (`obj.field`)
  - `nodeData.field`: Field name
  - `nodeData.testOnly`: Whether it's a test-only access
  - `nodeData.location`: Position in source
- **`call`**: Function calls (`func(args)`)
  - `nodeData.function`: Function name
  - `nodeData.argCount`: Number of arguments
  - `nodeData.hasTarget`: Whether it's a method call
  - `nodeData.location`: Position in source
- **`literal`**: Literal values (`"string"`, `42`, `true`)
  - `nodeData.value`: The literal value
  - `nodeData.type`: Type name
  - `nodeData.location`: Position in source
- **`ident`**: Variable references (`varName`)
  - `nodeData.name`: Variable name
  - `nodeData.location`: Position in source
- **`list`**: List literals (`[1, 2, 3]`)
  - `nodeData.elementCount`: Number of elements
  - `nodeData.location`: Position in source
- **`map`**: Map literals (`{"key": "value"}`)
  - `nodeData.entryCount`: Number of entries
  - `nodeData.location`: Position in source

#### CrossTypeNumericComparisons

Enables cross-type numeric comparisons for ordering operators (`<`, `<=`, `>`,
`>=`). This allows comparing values of different numeric types like
`double > int` or `int <= double`. Note that this only affects ordering
operators, not equality operators (`==`, `!=`).

```typescript
import { Env, Options } from "wasm-cel";

const env = await Env.new({
  variables: [
    { name: "doubleValue", type: "double" },
    { name: "intValue", type: "int" },
  ],
  options: [Options.crossTypeNumericComparisons()],
});

// Now you can use cross-type ordering comparisons:
const program = await env.compile("doubleValue > intValue");
const result = await program.eval({ doubleValue: 3.14, intValue: 3 });
console.log(result); // true

// Works with all ordering operators
const program2 = await env.compile("intValue <= doubleValue + 1.0");
const result2 = await program2.eval({ doubleValue: 2.5, intValue: 3 });
console.log(result2); // true
```

### Adding Options After Creation

You can also extend an environment with options after it's created:

```typescript
const env = await Env.new({
  variables: [
    {
      name: "data",
      type: { kind: "map", keyType: "string", valueType: "string" },
    },
  ],
});

// Add options later
await env.extend([Options.optionalTypes()]);

const program = await env.compile('data.?greeting.orValue("Hello")');
const result = await program.eval({ data: {} });
console.log(result); // "Hello"
```

### Complex Options with Setup

The library supports an inverted architecture where complex options can handle
their own JavaScript-side setup operations. This enables options that need to
register custom functions or perform other setup tasks.

**Architecture Benefits:**

- Options handle their own complexity and setup operations
- Environment class stays simple and focused
- Easy to add new complex options without modifying core code
- Clean separation of concerns

Complex options implement the `OptionWithSetup` interface and can perform setup
operations before being applied to the environment.

## API

### `Env.new(options?: EnvOptions): Promise<Env>`

Creates a new CEL environment with variable declarations, optional function
definitions, and CEL environment options.

**Parameters:**

- `options` (EnvOptions, optional): Options including:
  - `variables` (VariableDeclaration[], optional): Array of variable
    declarations with name and type
  - `functions` (CELFunctionDefinition[], optional): Array of custom function
    definitions
  - `options` (EnvOptionInput[], optional): Array of CEL environment options
    (like OptionalTypes)

**Returns:**

- `Promise<Env>`: A promise that resolves to a new Env instance

**Example:**

```typescript
import { Env, Options } from "wasm-cel";

const env = await Env.new({
  variables: [
    { name: "x", type: "int" },
    {
      name: "data",
      type: { kind: "map", keyType: "string", valueType: "string" },
    },
  ],
  options: [
    Options.optionalTypes(), // Enable optional syntax like data.?field
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

### `env.compileDetailed(expr: string): Promise<CompilationResult>`

Compiles a CEL expression with detailed results including warnings and
validation issues. This method is particularly useful when using ASTValidators
or when you need comprehensive feedback about the compilation process.

**Parameters:**

- `expr` (string): The CEL expression to compile

**Returns:**

- `Promise<CompilationResult>`: A promise that resolves to detailed compilation
  results with:
  - `success` (boolean): Whether compilation succeeded
  - `error` (string, optional): Error message if compilation failed completely
  - `issues` (CompilationIssue[]): All issues found during compilation (errors,
    warnings, info)
  - `program` (Program, optional): The compiled program if compilation succeeded

**Example:**

```typescript
const result = await env.compileDetailed("user.password");
if (result.success) {
  console.log("Compiled successfully");
  if (result.issues.length > 0) {
    console.log("Validation issues:", result.issues);
    // Example issue: { severity: "warning", message: "Accessing password field may not be secure" }
  }
  const evalResult = await result.program.eval({
    user: { password: "secret" },
  });
} else {
  console.log("Compilation failed:", result.error);
  console.log("All issues:", result.issues);
}
```

### `env.extend(options: EnvOptionInput[]): Promise<void>`

Extends the environment with additional CEL environment options after creation.

**Parameters:**

- `options` (EnvOptionInput[]): Array of CEL environment option configurations
  or complex options with setup

**Returns:**

- `Promise<void>`: A promise that resolves when the environment has been
  extended

**Example:**

```typescript
const env = await Env.new({
  variables: [{ name: "x", type: "int" }],
});

// Add options after creation
await env.extend([Options.optionalTypes()]);
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

### `init(wasmBytes?, wasmExecUrl?): Promise<void>`

Initializes the WASM module.

**Node.js:**

- No parameters needed - automatically loads from file system
- Called automatically by API functions, but can be called manually to
  pre-initialize

**Browser:**

- **Required**: `wasmBytes` - The WASM module. Can be:
  - `Uint8Array` - Direct bytes
  - `string` - URL to fetch the WASM file from (supports Vite-processed URLs)
  - `URL` - URL object pointing to the WASM file
  - `Response` - Fetch Response object containing WASM bytes
  - `Promise<Uint8Array>` - Async import of WASM bytes
- **Optional**: `wasmExecUrl` - URL to `wasm_exec.js` if it needs to be loaded
  dynamically
- Must be called before using the library

**Examples:**

```typescript
// Node.js - no parameters
await init();

// Browser - with Vite
import wasmUrl from "wasm-cel/main.wasm?url";
await init(wasmUrl);

// Browser - with URL
await init("/path/to/main.wasm");

// Browser - with wasm_exec.js URL
await init("/path/to/main.wasm", "/path/to/wasm_exec.js");

// Browser - with direct bytes
const bytes = new Uint8Array(
  await fetch("/main.wasm").then((r) => r.arrayBuffer()),
);
await init(bytes);
```

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
  Options,
  EnvOptions,
  VariableDeclaration,
  TypeCheckResult,
  CompilationResult,
  CompilationIssue,
  ValidationIssue,
  ValidationContext,
  ValidatorResult,
  ASTValidatorFunction,
  ASTValidatorsConfig,
  CrossTypeNumericComparisonsConfig,
  OptionalTypesConfig,
  EnvOptionConfig,
  EnvOptionInput,
} from "wasm-cel";
```

## Building from Source

To build the package from source, you'll need:

- Go 1.25 or later
- Node.js 18 or later
- Rust (stable)
- `wasm-opt` installed via `cargo install wasm-opt --version 0.116.1 --locked`
- pnpm (or npm/yarn)

```bash
# Install dependencies
pnpm install

# Build the WASM module and TypeScript
pnpm run build:all

# Run tests
pnpm test
```

## Requirements

- **Node.js**: >= 18.0.0
- **Browsers**: Modern browsers with WebAssembly support (all current browsers)

## Package Type

This is an **ESM-only** package. It uses modern ES modules and NodeNext module
resolution. If you're using TypeScript, make sure your `tsconfig.json` has
`"module": "NodeNext"` or `"moduleResolution": "NodeNext"` for proper type
resolution.

## Environment Detection

The library automatically detects the environment:

- **With bundlers** (Vite, Webpack, Rollup, etc.): Uses `package.json`
  conditional exports to select the correct entry point at build time
- **Native ES modules**: Uses runtime detection to select the appropriate module
- **Node.js**: Automatically uses the Node.js entry point with file system
  access
- **Browsers**: Uses the browser entry point that requires explicit WASM
  initialization

You don't need to change your import statements - the library handles the
environment detection automatically.

## License

MIT
