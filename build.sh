#!/bin/bash

# Build script for wasm-cel
# This script builds the WASM module and copies wasm_exec.js

set -e

echo "Building WASM module..."

# Build the WASM module
GOOS=js GOARCH=wasm go build -o main.wasm .

echo "✓ WASM module built successfully"

# Copy wasm_exec.js (check both old and new locations)
GOROOT=$(go env GOROOT)
WASM_EXEC_SRC1="$GOROOT/misc/wasm/wasm_exec.js"
WASM_EXEC_SRC2="$GOROOT/lib/wasm/wasm_exec.js"

if [ -f "$WASM_EXEC_SRC1" ]; then
    cp "$WASM_EXEC_SRC1" .
    echo "✓ wasm_exec.js copied successfully from misc/wasm/"
elif [ -f "$WASM_EXEC_SRC2" ]; then
    cp "$WASM_EXEC_SRC2" .
    echo "✓ wasm_exec.js copied successfully from lib/wasm/"
else
    echo "⚠ Warning: wasm_exec.js not found at $WASM_EXEC_SRC1 or $WASM_EXEC_SRC2"
    echo "  You may need to copy it manually or ensure Go is properly installed"
    exit 1
fi

echo ""
echo "Build complete! Files created:"
echo "  - main.wasm"
echo "  - wasm_exec.js"
