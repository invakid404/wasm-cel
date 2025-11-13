package cel

import (
	"encoding/json"
	"fmt"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/checker/decls"
	"github.com/google/cel-go/common/types"
	"github.com/google/cel-go/common/types/ref"
	"github.com/google/cel-go/common/types/traits"
	exprpb "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
)

// FunctionDef represents a custom function definition from JavaScript
type FunctionDef struct {
	Name       string      `json:"name"`
	Params     []ParamDef  `json:"params"`
	ReturnType interface{} `json:"returnType"` // Can be string or map[string]interface{}
	ImplID     string      `json:"implID"`     // ID to identify the JS function implementation
}

// ParamDef represents a function parameter definition
type ParamDef struct {
	Name     string      `json:"name"`
	Type     interface{} `json:"type"` // Can be string or map[string]interface{}
	Optional bool        `json:"optional,omitempty"`
}

// JSFunctionCaller is an interface for calling JavaScript functions from Go
// This allows the cel package to be testable without syscall/js dependency
type JSFunctionCaller interface {
	CallJSFunction(implID string, args []interface{}) (interface{}, error)
}

// Global registry to store JavaScript function callers
// This is set by the WASM layer
var jsFunctionCaller JSFunctionCaller

// SetJSFunctionCaller sets the JavaScript function caller
// This is called from the WASM layer
func SetJSFunctionCaller(caller JSFunctionCaller) {
	jsFunctionCaller = caller
}

// EvaluateCore evaluates a CEL expression with the given variables and custom functions
// This is the core evaluation logic without WASM-specific code
func EvaluateCore(exprStr string, vars map[string]interface{}, funcDefs []FunctionDef) map[string]interface{} {
	// Add variable declarations based on provided vars
	var varDecls []*exprpb.Decl
	for name, val := range vars {
		celType := inferDeclType(val)
		varDecls = append(varDecls, decls.NewVar(name, celType))
	}

	// Convert function definitions to CEL function declarations and implementations
	var funcDecls []*exprpb.Decl
	var funcImpls []cel.EnvOption
	for _, funcDef := range funcDefs {
		// Convert parameter types from exprpb.Type to cel.Type
		paramTypesExpr := make([]*exprpb.Type, 0, len(funcDef.Params))
		paramTypesCel := make([]*cel.Type, 0, len(funcDef.Params))
		for _, param := range funcDef.Params {
			paramTypeExpr := parseTypeDef(param.Type)
			paramTypesExpr = append(paramTypesExpr, paramTypeExpr)
			// Convert to cel.Type
			paramTypeCel, err := cel.ExprTypeToType(paramTypeExpr)
			if err != nil {
				return map[string]interface{}{
					"error": fmt.Sprintf("failed to convert parameter type: %v", err),
				}
			}
			paramTypesCel = append(paramTypesCel, paramTypeCel)
		}

		// Convert return type
		returnTypeExpr := parseTypeDef(funcDef.ReturnType)
		returnTypeCel, err := cel.ExprTypeToType(returnTypeExpr)
		if err != nil {
			return map[string]interface{}{
				"error": fmt.Sprintf("failed to convert return type: %v", err),
			}
		}

		overloadID := fmt.Sprintf("%s_%s", funcDef.Name, funcDef.ImplID)

		// Create function declaration (using exprpb types)
		funcDecl := decls.NewFunction(funcDef.Name,
			decls.NewOverload(
				overloadID,
				paramTypesExpr,
				returnTypeExpr,
			),
		)
		funcDecls = append(funcDecls, funcDecl)

		// Create function implementation that calls back to JavaScript (using cel types)
		implID := funcDef.ImplID
		funcImpl := cel.Function(funcDef.Name,
			cel.Overload(overloadID, paramTypesCel, returnTypeCel,
				cel.FunctionBinding(func(args ...ref.Val) ref.Val {
					// Convert CEL values to Go values
					goArgs := make([]interface{}, len(args))
					for i, arg := range args {
						goArgs[i] = ValueToJSON(arg)
					}

					// Call the registered JavaScript function
					if jsFunctionCaller != nil {
						result, err := jsFunctionCaller.CallJSFunction(implID, goArgs)
						if err != nil {
							return types.NewErr("function call error: %v", err)
						}
						// Convert result back to CEL value
						return JSONToValue(result)
					}

					return types.NewErr("JavaScript function caller not set")
				}),
			),
		)
		funcImpls = append(funcImpls, funcImpl)
	}

	// Create CEL environment with variable declarations and function declarations
	var env *cel.Env
	var err error
	opts := []cel.EnvOption{}
	if len(varDecls) > 0 {
		opts = append(opts, cel.Declarations(varDecls...))
	}
	if len(funcDecls) > 0 {
		opts = append(opts, cel.Declarations(funcDecls...))
	}
	if len(funcImpls) > 0 {
		opts = append(opts, funcImpls...)
	}

	if len(opts) > 0 {
		env, err = cel.NewEnv(opts...)
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
	result := ValueToJSON(out)

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

// parseTypeDef parses a type definition from JSON into a CEL type
// typeDef can be a string (type name) or a map[string]interface{} (complex type)
func parseTypeDef(typeDef interface{}) *exprpb.Type {
	// If it's a string, treat it as a simple type name
	if typeName, ok := typeDef.(string); ok {
		return parseTypeName(typeName)
	}

	// Otherwise, it should be a map
	typeDefMap, ok := typeDef.(map[string]interface{})
	if !ok {
		return decls.Dyn
	}

	if kind, ok := typeDefMap["kind"].(string); ok {
		switch kind {
		case "list":
			if elemType, ok := typeDefMap["elementType"].(map[string]interface{}); ok {
				return decls.NewListType(parseTypeDef(elemType))
			}
			// Fallback to string type name
			if elemTypeStr, ok := typeDefMap["elementType"].(string); ok {
				return decls.NewListType(parseTypeDef(elemTypeStr))
			}
			return decls.NewListType(decls.Dyn)
		case "map":
			keyType := decls.String
			valueType := decls.Dyn
			if kt, ok := typeDefMap["keyType"].(string); ok {
				keyType = parseTypeName(kt)
			} else if ktMap, ok := typeDefMap["keyType"].(map[string]interface{}); ok {
				keyType = parseTypeDef(ktMap)
			}
			if vt, ok := typeDefMap["valueType"].(map[string]interface{}); ok {
				valueType = parseTypeDef(vt)
			} else if vt, ok := typeDefMap["valueType"].(string); ok {
				valueType = parseTypeDef(vt)
			}
			return decls.NewMapType(keyType, valueType)
		}
	}

	// Try as string type name in map
	if typeName, ok := typeDefMap["type"].(string); ok {
		return parseTypeName(typeName)
	}
	if typeName, ok := typeDefMap["name"].(string); ok {
		return parseTypeName(typeName)
	}

	return decls.Dyn
}

// parseTypeName parses a type name string into a CEL type
func parseTypeName(typeName string) *exprpb.Type {
	switch typeName {
	case "bool":
		return decls.Bool
	case "int":
		return decls.Int
	case "uint":
		return decls.Uint
	case "double":
		return decls.Double
	case "string":
		return decls.String
	case "bytes":
		return decls.Bytes
	case "timestamp":
		return decls.Timestamp
	case "duration":
		return decls.Duration
	case "null":
		return decls.Null
	case "dyn", "any":
		return decls.Dyn
	default:
		return decls.Dyn
	}
}

// ValueToJSON converts a CEL ref.Val to a JSON-serializable value
func ValueToJSON(val ref.Val) interface{} {
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
			result[i] = ValueToJSON(v.Get(types.Int(i)))
		}
		return result
	case traits.Mapper:
		result := make(map[string]interface{})
		it := v.Iterator()
		for it.HasNext() == types.True {
			key := it.Next()
			val := v.Get(key)
			keyStr := fmt.Sprintf("%v", ValueToJSON(key))
			result[keyStr] = ValueToJSON(val)
		}
		return result
	default:
		// For unknown types, try to convert to string
		return fmt.Sprintf("%v", val)
	}
}

// JSONToValue converts a JSON-serializable value to a CEL ref.Val
func JSONToValue(val interface{}) ref.Val {
	if val == nil {
		return types.NullValue
	}

	switch v := val.(type) {
	case bool:
		return types.Bool(v)
	case int:
		return types.Int(v)
	case int8:
		return types.Int(v)
	case int16:
		return types.Int(v)
	case int32:
		return types.Int(v)
	case int64:
		return types.Int(v)
	case uint:
		return types.Uint(v)
	case uint8:
		return types.Uint(v)
	case uint16:
		return types.Uint(v)
	case uint32:
		return types.Uint(v)
	case uint64:
		return types.Uint(v)
	case float32:
		return types.Double(v)
	case float64:
		return types.Double(v)
	case string:
		return types.String(v)
	case []byte:
		return types.Bytes(v)
	case []interface{}:
		items := make([]ref.Val, len(v))
		for i, item := range v {
			items[i] = JSONToValue(item)
		}
		return types.NewDynamicList(types.DefaultTypeAdapter, items)
	case map[string]interface{}:
		result := make(map[ref.Val]ref.Val)
		for k, v := range v {
			result[types.String(k)] = JSONToValue(v)
		}
		return types.NewDynamicMap(types.DefaultTypeAdapter, result)
	default:
		// Try to convert via JSON marshaling/unmarshaling
		jsonBytes, err := json.Marshal(val)
		if err != nil {
			return types.NewErr("failed to convert value: %v", err)
		}
		var jsonVal interface{}
		if err := json.Unmarshal(jsonBytes, &jsonVal); err != nil {
			return types.NewErr("failed to unmarshal value: %v", err)
		}
		return JSONToValue(jsonVal)
	}
}
