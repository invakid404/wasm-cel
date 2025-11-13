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

```typescript
import { evaluateCEL } from 'wasm-cel';

// Basic arithmetic
const result1 = await evaluateCEL('10 + 20 * 2');
console.log(result1.result); // 50

// Expression with variables
const result2 = await evaluateCEL('x + y', { x: 10, y: 20 });
console.log(result2.result); // 30

// String operations
const result3 = await evaluateCEL(
  'name + " is " + string(age) + " years old"',
  { name: 'Alice', age: 30 }
);
console.log(result3.result); // "Alice is 30 years old"

// Comparison and ternary
const result4 = await evaluateCEL('x > y ? "greater" : "lesser"', {
  x: 10,
  y: 5
});
console.log(result4.result); // "greater"

// List operations
const result5 = await evaluateCEL('myList.size()', {
  myList: [1, 2, 3, 4, 5]
});
console.log(result5.result); // 5

// Map operations
const result6 = await evaluateCEL('user["name"]', {
  user: { name: 'Bob', score: 100 }
});
console.log(result6.result); // "Bob"
```

## API

### `evaluateCEL(expr: string, vars?: Variables): Promise<EvaluateResult>`

Evaluates a CEL expression with optional variables.

**Parameters:**
- `expr` (string): The CEL expression to evaluate
- `vars` (Variables, optional): Variables to use in the expression. Can be an object or `null`. Defaults to `{}`.

**Returns:**
- `Promise<EvaluateResult>`: A promise that resolves to an object with:
  - `result` (any): The result of the evaluation, or `null` if there was an error
  - `error` (string | null): Error message if evaluation failed, or `null` if successful

**Throws:**
- `Error`: If the expression is invalid, evaluation fails, or input validation fails

### `init(): Promise<void>`

Initializes the WASM module. This is called automatically by `evaluateCEL`, but can be called manually to pre-initialize the module.

## TypeScript Support

This package includes TypeScript type definitions. Import types as needed:

```typescript
import { evaluateCEL, EvaluateResult, Variables } from 'wasm-cel';
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
