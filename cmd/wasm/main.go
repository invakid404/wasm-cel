//go:build js && wasm

package main

import (
	"encoding/json"
	"fmt"
	"syscall/js"

	"github.com/invakid404/wasm-cel/internal/cel"
)

// jsFunctionCaller implements cel.JSFunctionCaller using syscall/js
type jsFunctionCaller struct {
	registry map[string]js.Value
}

func (c *jsFunctionCaller) CallJSFunction(implID string, args []interface{}) (interface{}, error) {
	fn, ok := c.registry[implID]
	if !ok {
		return nil, fmt.Errorf("function implementation not found: %s", implID)
	}

	// Convert Go values to JavaScript values
	jsArgs := make([]interface{}, len(args))
	for i, arg := range args {
		jsArgs[i] = arg
	}

	// Call the JavaScript function
	result := fn.Invoke(jsArgs...)
	if result.IsNull() || result.IsUndefined() {
		return nil, nil
	}

	// Convert JavaScript result to Go value
	resultJSON := js.Global().Get("JSON").Call("stringify", result).String()
	var goResult interface{}
	if err := json.Unmarshal([]byte(resultJSON), &goResult); err != nil {
		return nil, fmt.Errorf("failed to parse function result: %v", err)
	}

	return goResult, nil
}

var functionCaller = &jsFunctionCaller{
	registry: make(map[string]js.Value),
}

// registerFunction registers a JavaScript function implementation
func registerFunction(this js.Value, args []js.Value) interface{} {
	if len(args) < 2 {
		return map[string]interface{}{
			"error": "expected 2 arguments: implID string, function",
		}
	}

	implID := args[0].String()
	fn := args[1]

	if fn.Type() != js.TypeFunction {
		return map[string]interface{}{
			"error": "second argument must be a function",
		}
	}

	functionCaller.registry[implID] = fn
	return map[string]interface{}{
		"success": true,
	}
}

// evaluateCEL evaluates a CEL expression with the given variables and custom functions
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

	// Parse function definitions from third argument if provided
	var funcDefs []cel.FunctionDef
	if len(args) >= 3 && !args[2].IsNull() && !args[2].IsUndefined() {
		funcDefsJSON := js.Global().Get("JSON").Call("stringify", args[2]).String()
		if err := json.Unmarshal([]byte(funcDefsJSON), &funcDefs); err != nil {
			return map[string]interface{}{
				"error": fmt.Sprintf("failed to parse function definitions: %v", err),
			}
		}
	}

	// Use the core evaluation function
	return cel.EvaluateCore(exprStr, vars, funcDefs)
}

func main() {
	// Set the JavaScript function caller
	cel.SetJSFunctionCaller(functionCaller)

	// Register the evaluateCEL function as a global JavaScript function
	js.Global().Set("evaluateCEL", js.FuncOf(evaluateCEL))

	// Register the registerFunction function for registering JS function implementations
	js.Global().Set("registerCELFunction", js.FuncOf(registerFunction))

	// Keep the program running
	// In WASM, we need to keep the main goroutine alive
	select {}
}
