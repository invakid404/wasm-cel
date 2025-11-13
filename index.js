const fs = require('fs');
const path = require('path');

// Load wasm_exec.js if it exists, otherwise use a fallback
let wasmExecPath = path.join(__dirname, 'wasm_exec.js');
if (!fs.existsSync(wasmExecPath)) {
  // Try to find it in Go installation
  const goRoot = process.env.GOROOT || require('child_process').execSync('go env GOROOT', { encoding: 'utf-8' }).trim();
  wasmExecPath = path.join(goRoot, 'misc', 'wasm', 'wasm_exec.js');
}

if (fs.existsSync(wasmExecPath)) {
  require(wasmExecPath);
} else {
  throw new Error(`wasm_exec.js not found. Please ensure Go is installed and wasm_exec.js is available at ${wasmExecPath}`);
}

let wasmModule = null;
let isInitialized = false;
let initPromise = null;

/**
 * Initialize the WASM module
 * @returns {Promise<void>}
 */
async function init() {
  if (isInitialized) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise((resolve, reject) => {
    const wasmPath = path.join(__dirname, 'main.wasm');
    
    if (!fs.existsSync(wasmPath)) {
      reject(new Error(`WASM file not found at ${wasmPath}. Please build it first using 'npm run build' or 'go build -o main.wasm -target wasm ./main.go'`));
      return;
    }

    const go = new Go();
    const wasmBuffer = fs.readFileSync(wasmPath);
    
    WebAssembly.instantiate(wasmBuffer, go.importObject)
      .then(result => {
        go.run(result.instance);
        wasmModule = result.instance;
        isInitialized = true;
        resolve();
      })
      .catch(err => {
        reject(new Error(`Failed to instantiate WASM module: ${err.message}`));
      });
  });

  return initPromise;
}

/**
 * Evaluate a CEL expression with variables
 * @param {string} expr - The CEL expression to evaluate
 * @param {Object} vars - Variables to use in the expression (optional)
 * @returns {Promise<{result: any, error: string|null}>}
 */
async function evaluateCEL(expr, vars = {}) {
  // Ensure WASM is initialized
  await init();

  if (typeof expr !== 'string') {
    throw new Error('First argument must be a string (CEL expression)');
  }

  if (vars !== null && typeof vars !== 'object') {
    throw new Error('Second argument must be an object (variables map) or null');
  }

  return new Promise((resolve, reject) => {
    try {
      // Call the global evaluateCEL function exposed by Go
      const result = global.evaluateCEL(expr, vars || {});
      
      // Convert the result to a plain JavaScript object
      const resultObj = {
        result: result.result !== undefined ? result.result : null,
        error: result.error || null
      };

      if (resultObj.error) {
        reject(new Error(resultObj.error));
      } else {
        resolve(resultObj);
      }
    } catch (err) {
      reject(new Error(`WASM call failed: ${err.message}`));
    }
  });
}

module.exports = {
  evaluateCEL,
  init
};
