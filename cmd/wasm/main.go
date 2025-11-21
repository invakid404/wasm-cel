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

// UnregisterFunction removes a function implementation from the registry
func (c *jsFunctionCaller) UnregisterFunction(implID string) {
	delete(c.registry, implID)
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

// createEnv creates a new CEL environment
func createEnv(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return map[string]interface{}{
			"error": "expected at least 1 argument: varDecls array",
		}
	}

	// Parse variable declarations from first argument
	var varDecls []cel.VarDecl
	if !args[0].IsNull() && !args[0].IsUndefined() {
		varDeclsJSON := js.Global().Get("JSON").Call("stringify", args[0]).String()
		if err := json.Unmarshal([]byte(varDeclsJSON), &varDecls); err != nil {
			return map[string]interface{}{
				"error": fmt.Sprintf("failed to parse variable declarations: %v", err),
			}
		}
	}

	// Parse function definitions from second argument if provided
	var funcDefs []cel.FunctionDef
	if len(args) >= 2 && !args[1].IsNull() && !args[1].IsUndefined() {
		funcDefsJSON := js.Global().Get("JSON").Call("stringify", args[1]).String()
		if err := json.Unmarshal([]byte(funcDefsJSON), &funcDefs); err != nil {
			return map[string]interface{}{
				"error": fmt.Sprintf("failed to parse function definitions: %v", err),
			}
		}
	}

	return cel.CreateEnv(varDecls, funcDefs)
}

// compileExpr compiles a CEL expression using an environment
func compileExpr(this js.Value, args []js.Value) interface{} {
	if len(args) < 2 {
		return map[string]interface{}{
			"error": "expected 2 arguments: envID string, expression string",
		}
	}

	envID := args[0].String()
	exprStr := args[1].String()

	return cel.Compile(envID, exprStr)
}

// typecheckExpr typechecks a CEL expression using an environment
func typecheckExpr(this js.Value, args []js.Value) interface{} {
	if len(args) < 2 {
		return map[string]interface{}{
			"error": "expected 2 arguments: envID string, expression string",
		}
	}

	envID := args[0].String()
	exprStr := args[1].String()

	return cel.Typecheck(envID, exprStr)
}

// evalProgram evaluates a compiled program
func evalProgram(this js.Value, args []js.Value) interface{} {
	if len(args) < 2 {
		return map[string]interface{}{
			"error": "expected 2 arguments: programID string, vars object",
		}
	}

	programID := args[0].String()

	// Parse variables from second argument
	var vars map[string]interface{}
	if !args[1].IsNull() && !args[1].IsUndefined() {
		varsJSON := js.Global().Get("JSON").Call("stringify", args[1]).String()
		if err := json.Unmarshal([]byte(varsJSON), &vars); err != nil {
			return map[string]interface{}{
				"error": fmt.Sprintf("failed to parse variables: %v", err),
			}
		}
	} else {
		vars = make(map[string]interface{})
	}

	return cel.Eval(programID, vars)
}

// destroyEnv destroys an environment and cleans up associated resources
func destroyEnv(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return map[string]interface{}{
			"error": "expected 1 argument: envID string",
		}
	}

	envID := args[0].String()
	return cel.DestroyEnv(envID)
}

// destroyProgram destroys a compiled program
func destroyProgram(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return map[string]interface{}{
			"error": "expected 1 argument: programID string",
		}
	}

	programID := args[0].String()
	return cel.DestroyProgram(programID)
}

// extendEnv extends an existing environment with additional options
func extendEnv(this js.Value, args []js.Value) interface{} {
	if len(args) < 2 {
		return map[string]interface{}{
			"error": "expected 2 arguments: envID string, options string",
		}
	}

	envID := args[0].String()
	optionsJSON := args[1].String()

	return cel.ExtendEnv(envID, optionsJSON)
}


func main() {
	// Set the JavaScript function caller
	cel.SetJSFunctionCaller(functionCaller)
	// Set the unregister function caller (same instance)
	cel.SetUnregisterFunctionCaller(functionCaller)

	// Register the registerFunction function for registering JS function implementations
	js.Global().Set("registerCELFunction", js.FuncOf(registerFunction))

	// Register the API functions
	js.Global().Set("createEnv", js.FuncOf(createEnv))
	js.Global().Set("extendEnv", js.FuncOf(extendEnv))
	js.Global().Set("compileExpr", js.FuncOf(compileExpr))
	js.Global().Set("typecheckExpr", js.FuncOf(typecheckExpr))
	js.Global().Set("evalProgram", js.FuncOf(evalProgram))
	js.Global().Set("destroyEnv", js.FuncOf(destroyEnv))
	js.Global().Set("destroyProgram", js.FuncOf(destroyProgram))


	// Keep the program running
	// In WASM, we need to keep the main goroutine alive
	select {}
}
