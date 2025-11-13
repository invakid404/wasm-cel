//go:build js && wasm

package main

import (
	"encoding/json"
	"fmt"
	"syscall/js"
)

// evaluateCEL evaluates a CEL expression with the given variables
// It's exposed to JavaScript as a global function
func evaluateCEL(this js.Value, args []js.Value) interface{} {
	// Ensure we have at least one argument (the expression)
	if len(args) < 1 {
		return map[string]interface{}{
			"error": "expected at least 1 argument: expression string",
		}
	}

	exprStr := args[0].String()
	
	// Parse variables from second argument if provided
	var vars map[string]interface{}
	if len(args) >= 2 && !args[1].IsNull() && !args[1].IsUndefined() {
		varsJSON := js.Global().Get("JSON").Call("stringify", args[1]).String()
		if err := json.Unmarshal([]byte(varsJSON), &vars); err != nil {
			return map[string]interface{}{
				"error": fmt.Sprintf("failed to parse variables: %v", err),
			}
		}
	} else {
		vars = make(map[string]interface{})
	}

	// Use the core evaluation function
	return EvaluateCELCore(exprStr, vars)
}

func main() {
	// Register the evaluateCEL function as a global JavaScript function
	js.Global().Set("evaluateCEL", js.FuncOf(evaluateCEL))
	
	// Keep the program running
	// In WASM, we need to keep the main goroutine alive
	select {}
}
