package main

import (
	"fmt"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/checker/decls"
	"github.com/google/cel-go/common/types"
	"github.com/google/cel-go/common/types/ref"
	"github.com/google/cel-go/common/types/traits"
	exprpb "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
)

// EvaluateCELCore evaluates a CEL expression with the given variables
// This is the core evaluation logic without WASM-specific code
func EvaluateCELCore(exprStr string, vars map[string]interface{}) map[string]interface{} {
	// Add variable declarations based on provided vars
	var varDecls []*exprpb.Decl
	for name, val := range vars {
		celType := inferDeclType(val)
		varDecls = append(varDecls, decls.NewVar(name, celType))
	}

	// Create CEL environment with variable declarations
	var env *cel.Env
	var err error
	if len(varDecls) > 0 {
		env, err = cel.NewEnv(cel.Declarations(varDecls...))
	} else {
		env, err = cel.NewEnv()
	}
	if err != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("failed to create CEL environment: %v", err),
		}
	}

	// Parse and compile the expression
	ast, issues := env.Compile(exprStr)
	if issues != nil && issues.Err() != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("compilation error: %v", issues.Err()),
		}
	}

	// Check for compilation errors
	if !ast.IsChecked() {
		return map[string]interface{}{
			"error": "expression compilation failed: not checked",
		}
	}

	// Create program
	prg, err := env.Program(ast)
	if err != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("failed to create program: %v", err),
		}
	}

	// Evaluate the program with variables
	out, _, err := prg.Eval(map[string]interface{}(vars))
	if err != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("evaluation error: %v", err),
		}
	}

	// Convert CEL value to JSON-serializable value
	result := celValueToJSON(out)

	return map[string]interface{}{
		"result": result,
		"error":  nil,
	}
}

// inferDeclType infers the CEL declaration type from a Go value
func inferDeclType(val interface{}) *exprpb.Type {
	switch val.(type) {
	case bool:
		return decls.Bool
	case int, int8, int16, int32, int64:
		return decls.Int
	case uint, uint8, uint16, uint32, uint64:
		return decls.Int
	case float32, float64:
		return decls.Double
	case string:
		return decls.String
	case []interface{}:
		return decls.NewListType(decls.Dyn)
	case map[string]interface{}:
		return decls.NewMapType(decls.String, decls.Dyn)
	default:
		return decls.Dyn
	}
}

// celValueToJSON converts a CEL ref.Val to a JSON-serializable value
func celValueToJSON(val ref.Val) interface{} {
	if val == nil {
		return nil
	}

	switch v := val.(type) {
	case types.Bool:
		return bool(v)
	case types.Int:
		return int64(v)
	case types.Uint:
		return uint64(v)
	case types.Double:
		return float64(v)
	case types.String:
		return string(v)
	case types.Bytes:
		return []byte(v)
	case traits.Lister:
		size := v.Size().Value().(int64)
		result := make([]interface{}, size)
		for i := int64(0); i < size; i++ {
			result[i] = celValueToJSON(v.Get(types.Int(i)))
		}
		return result
	case traits.Mapper:
		result := make(map[string]interface{})
		it := v.Iterator()
		for it.HasNext() == types.True {
			key := it.Next()
			val := v.Get(key)
			keyStr := fmt.Sprintf("%v", celValueToJSON(key))
			result[keyStr] = celValueToJSON(val)
		}
		return result
	default:
		// For unknown types, try to convert to string
		return fmt.Sprintf("%v", val)
	}
}
