package cel

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/checker/decls"
	"github.com/google/cel-go/common"
	"github.com/google/cel-go/common/types"
	"github.com/google/cel-go/common/types/ref"
	"github.com/google/cel-go/common/types/traits"
	commonTypes "github.com/invakid404/wasm-cel/internal/common"
	"github.com/invakid404/wasm-cel/internal/wasmenv"
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

// Global registry for compilation contexts using the "Filename Side-Channel" pattern
// Maps unique compilation ID -> issue collector
var compilationRegistry sync.Map

// Use common types to avoid duplication
type CompilationIssueCollector = commonTypes.CompilationIssueCollector

// CompilationIssueCollectorImpl implements CompilationIssueCollector
type CompilationIssueCollectorImpl struct {
	issues []ValidatorIssue
}

func (c *CompilationIssueCollectorImpl) AddValidatorIssue(issue ValidatorIssue) {
	c.issues = append(c.issues, issue)
}

func (c *CompilationIssueCollectorImpl) GetValidatorIssues() []ValidatorIssue {
	return c.issues
}

// NewCompilationIssueCollector creates a new compilation-scoped issue collector
func NewCompilationIssueCollector() CompilationIssueCollector {
	return &CompilationIssueCollectorImpl{
		issues: make([]ValidatorIssue, 0),
	}
}

// RegisterCompilationContext registers a compilation context with a unique ID
func RegisterCompilationContext(compilationID string, collector CompilationIssueCollector) {
	compilationRegistry.Store(compilationID, collector)
}

// GetCompilationContext retrieves a compilation context by ID
func GetCompilationContext(compilationID string) CompilationIssueCollector {
	if val, ok := compilationRegistry.Load(compilationID); ok {
		return val.(CompilationIssueCollector)
	}
	return nil
}

// GetCompilationContextAdder retrieves a compilation context by ID as an adder interface
// This is used by the options package which only needs to add issues
func GetCompilationContextAdder(compilationID string) commonTypes.CompilationIssueAdder {
	return GetCompilationContext(compilationID)
}

// UnregisterCompilationContext removes a compilation context (important for cleanup)
func UnregisterCompilationContext(compilationID string) {
	compilationRegistry.Delete(compilationID)
}

type ValidatorIssue = commonTypes.ValidatorIssue

// EnvState holds a CEL environment
type EnvState struct {
	env       *cel.Env
	implIDs   []string // Track function implementation IDs for cleanup
	destroyed bool     // Track if environment has been destroyed
}

// ProgramState holds a compiled CEL program
type ProgramState struct {
	prg   cel.Program
	envID string // Track which environment created this program
}

// FunctionRefCount tracks reference counts for function implementations
type FunctionRefCount struct {
	refCount int    // Number of programs that might use this function
	envID    string // Which environment this function belongs to
}

// Global registries for environments and programs
var (
	envs                 = make(map[string]*EnvState)
	programs             = make(map[string]*ProgramState)
	functionRefs         = make(map[string]*FunctionRefCount) // Track function reference counts
	envIDCounter         int64
	programIDCounter     int64
	compilationIDCounter int64
)

// VarDecl represents a variable declaration with a name and type
type VarDecl struct {
	Name string      `json:"name"`
	Type interface{} `json:"type"` // Can be string or map[string]interface{}
}

// CreateEnv creates a new CEL environment with variable declarations and function definitions
// Returns an environment ID that can be used for compilation
func CreateEnv(varDecls []VarDecl, funcDefs []FunctionDef) map[string]interface{} {
	return CreateEnvWithOptions(varDecls, funcDefs, nil)
}

// ExtendEnv extends an existing environment with additional options
// This allows adding options that require JavaScript functions after the environment is created
func ExtendEnv(envID string, optionsJSON string) map[string]interface{} {
	envState, ok := envs[envID]
	if !ok {
		return map[string]interface{}{
			"error": fmt.Sprintf("environment not found: %s", envID),
		}
	}

	// Check if environment has been destroyed
	if envState.destroyed {
		return map[string]interface{}{
			"error": fmt.Sprintf("environment has been destroyed: %s", envID),
		}
	}

	// Parse and create the new options with environment ID
	envOptions, err := wasmenv.CreateOptionsFromJSONWithEnvID(optionsJSON, envID)
	if err != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("failed to create environment options: %v", err),
		}
	}

	// Extend the existing environment with new options
	newEnv, err := envState.env.Extend(envOptions...)
	if err != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("failed to extend environment: %v", err),
		}
	}

	// Replace the environment pointer with the extended environment
	envState.env = newEnv

	return map[string]interface{}{
		"success": true,
		"error":   nil,
	}
}

// CreateEnvWithOptions creates a new CEL environment with variable declarations, function definitions, and environment options
// Returns an environment ID that can be used for compilation
func CreateEnvWithOptions(varDecls []VarDecl, funcDefs []FunctionDef, optionsJSON *string) map[string]interface{} {
	// Convert variable declarations to CEL declarations
	var celVarDecls []*exprpb.Decl
	for _, varDecl := range varDecls {
		celType := parseTypeDef(varDecl.Type)
		celVarDecls = append(celVarDecls, decls.NewVar(varDecl.Name, celType))
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

	// Create CEL environment with variable declarations, function declarations, and options
	var env *cel.Env
	var err error
	opts := []cel.EnvOption{}

	// Add variable declarations
	if len(celVarDecls) > 0 {
		opts = append(opts, cel.Declarations(celVarDecls...))
	}

	// Add function declarations
	if len(funcDecls) > 0 {
		opts = append(opts, cel.Declarations(funcDecls...))
	}

	// Add function implementations
	if len(funcImpls) > 0 {
		opts = append(opts, funcImpls...)
	}

	// Generate a unique environment ID first (needed for options creation)
	envIDCounter++
	envID := fmt.Sprintf("env_%d", envIDCounter)

	// Add environment options from configuration
	if optionsJSON != nil && *optionsJSON != "" {
		envOptions, err := wasmenv.CreateOptionsFromJSONWithEnvID(*optionsJSON, envID)
		if err != nil {
			return map[string]interface{}{
				"error": fmt.Sprintf("failed to create environment options: %v", err),
			}
		}
		opts = append(opts, envOptions...)
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

	// Collect function implementation IDs for cleanup tracking
	implIDs := make([]string, 0, len(funcDefs))
	for _, funcDef := range funcDefs {
		implIDs = append(implIDs, funcDef.ImplID)
		// Initialize function reference count (starts at 0, will be incremented when programs use it)
		functionRefs[funcDef.ImplID] = &FunctionRefCount{
			refCount: 0,
			envID:    envID,
		}
	}

	envs[envID] = &EnvState{
		env:       env,
		implIDs:   implIDs,
		destroyed: false,
	}

	return map[string]interface{}{
		"envID": envID,
		"error": nil,
	}
}

// Compile compiles a CEL expression using the specified environment
// Returns a program ID that can be used for evaluation
func Compile(envID string, exprStr string) map[string]interface{} {
	envState, ok := envs[envID]
	if !ok {
		return map[string]interface{}{
			"error": fmt.Sprintf("environment not found: %s", envID),
		}
	}

	// Check if environment has been destroyed
	if envState.destroyed {
		return map[string]interface{}{
			"error": fmt.Sprintf("environment has been destroyed: %s", envID),
		}
	}

	// Parse and compile the expression
	ast, issues := envState.env.Compile(exprStr)
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
	prg, err := envState.env.Program(ast)
	if err != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("failed to create program: %v", err),
		}
	}

	// Generate a unique program ID
	programIDCounter++
	programID := fmt.Sprintf("prg_%d", programIDCounter)
	programs[programID] = &ProgramState{
		prg:   prg,
		envID: envID,
	}

	// Increment reference counts for all functions in this environment
	// Programs can potentially use any function from their environment
	for _, implID := range envState.implIDs {
		if ref, ok := functionRefs[implID]; ok {
			ref.refCount++
		}
	}

	return map[string]interface{}{
		"programID": programID,
		"error":     nil,
	}
}

// CompileDetailed compiles a CEL expression and returns detailed results including all issues
func CompileDetailed(envID string, exprStr string) map[string]interface{} {
	envState, ok := envs[envID]
	if !ok {
		return map[string]interface{}{
			"error":  fmt.Sprintf("environment not found: %s", envID),
			"issues": []interface{}{},
		}
	}

	// Check if environment has been destroyed
	if envState.destroyed {
		return map[string]interface{}{
			"error":  fmt.Sprintf("environment has been destroyed: %s", envID),
			"issues": []interface{}{},
		}
	}

	// Create a compilation-scoped issue collector
	compilationCollector := NewCompilationIssueCollector()

	// Generate a unique compilation ID (using the filename side-channel pattern)
	compilationIDCounter++
	compilationID := fmt.Sprintf("comp_%d_%p", compilationIDCounter, &compilationCollector)

	// Register the compilation context
	RegisterCompilationContext(compilationID, compilationCollector)
	defer UnregisterCompilationContext(compilationID) // Important: cleanup to prevent memory leaks

	// Create source with compilation ID as the description (filename side-channel)
	source := common.NewStringSource(exprStr, compilationID)

	// Use ParseSource + Check with the compilation ID embedded in the source description
	ast, issues := envState.env.ParseSource(source)
	if issues.Err() == nil {
		ast, issues = envState.env.Check(ast)
	}

	// Convert all issues to JavaScript-compatible format
	var jsIssues []interface{}

	// Add CEL built-in issues first
	if issues != nil {
		for _, err := range issues.Errors() {
			jsIssues = append(jsIssues, map[string]interface{}{
				"severity": "error",
				"message":  err.Message,
				"location": map[string]interface{}{
					"line":   int(err.Location.Line()),
					"column": int(err.Location.Column()),
				},
			})
		}
	}

	// Add custom validator issues from this compilation
	for _, validatorIssue := range compilationCollector.GetValidatorIssues() {
		jsIssue := map[string]interface{}{
			"severity": validatorIssue.Severity,
			"message":  validatorIssue.Message,
		}
		if validatorIssue.Location != nil {
			jsIssue["location"] = validatorIssue.Location
		}
		jsIssues = append(jsIssues, jsIssue)
	}

	// Check if compilation failed completely
	if issues != nil && issues.Err() != nil {
		return map[string]interface{}{
			"error":     fmt.Sprintf("compilation error: %v", issues.Err()),
			"issues":    jsIssues,
			"programID": nil,
		}
	}

	// Check for compilation errors
	if !ast.IsChecked() {
		return map[string]interface{}{
			"error":     "expression compilation failed: not checked",
			"issues":    jsIssues,
			"programID": nil,
		}
	}

	// Create program
	prg, err := envState.env.Program(ast)
	if err != nil {
		return map[string]interface{}{
			"error":     fmt.Sprintf("failed to create program: %v", err),
			"issues":    jsIssues,
			"programID": nil,
		}
	}

	// Generate a unique program ID
	programIDCounter++
	programID := fmt.Sprintf("prg_%d", programIDCounter)
	programs[programID] = &ProgramState{
		prg:   prg,
		envID: envID,
	}

	// Increment reference counts for all functions in this environment
	// Programs can potentially use any function from their environment
	for _, implID := range envState.implIDs {
		if ref, ok := functionRefs[implID]; ok {
			ref.refCount++
		}
	}

	return map[string]interface{}{
		"programID": programID,
		"error":     nil,
		"issues":    jsIssues,
	}
}

// Typecheck typechecks a CEL expression using the specified environment
// Returns the type of the expression without compiling it
func Typecheck(envID string, exprStr string) map[string]interface{} {
	envState, ok := envs[envID]
	if !ok {
		return map[string]interface{}{
			"error": fmt.Sprintf("environment not found: %s", envID),
		}
	}

	// Check if environment has been destroyed
	if envState.destroyed {
		return map[string]interface{}{
			"error": fmt.Sprintf("environment has been destroyed: %s", envID),
		}
	}

	// Parse and compile the expression (this performs typechecking)
	ast, issues := envState.env.Compile(exprStr)
	if issues != nil && issues.Err() != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("typecheck error: %v", issues.Err()),
		}
	}

	// Check for compilation errors
	if !ast.IsChecked() {
		return map[string]interface{}{
			"error": "expression typecheck failed: not checked",
		}
	}

	// Get the type of the expression
	exprType := ast.OutputType()
	if exprType == nil {
		return map[string]interface{}{
			"error": "expression has no type information",
		}
	}

	// Convert cel.Type to exprpb.Type
	exprTypeExpr, err := cel.TypeToExprType(exprType)
	if err != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("failed to convert type: %v", err),
		}
	}

	// Convert the type to JSON-serializable format
	typeInfo := typeToJSON(exprTypeExpr)

	return map[string]interface{}{
		"type":  typeInfo,
		"error": nil,
	}
}

// Eval evaluates a compiled program with the given variables
func Eval(programID string, vars map[string]interface{}) map[string]interface{} {
	programState, ok := programs[programID]
	if !ok {
		return map[string]interface{}{
			"error": fmt.Sprintf("program not found: %s", programID),
		}
	}

	// Evaluate the program with variables
	out, _, err := programState.prg.Eval(vars)
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

// typeToJSON converts a CEL exprpb.Type to a JSON-serializable format
// This is the inverse of parseTypeDef
func typeToJSON(exprType *exprpb.Type) interface{} {
	if exprType == nil {
		return "dyn"
	}

	switch exprType.GetTypeKind().(type) {
	case *exprpb.Type_Primitive:
		switch exprType.GetPrimitive() {
		case exprpb.Type_BOOL:
			return "bool"
		case exprpb.Type_INT64:
			return "int"
		case exprpb.Type_UINT64:
			return "uint"
		case exprpb.Type_DOUBLE:
			return "double"
		case exprpb.Type_STRING:
			return "string"
		case exprpb.Type_BYTES:
			return "bytes"
		}
	case *exprpb.Type_WellKnown:
		switch exprType.GetWellKnown() {
		case exprpb.Type_TIMESTAMP:
			return "timestamp"
		case exprpb.Type_DURATION:
			return "duration"
		}
	case *exprpb.Type_ListType_:
		elemType := exprType.GetListType().GetElemType()
		return map[string]interface{}{
			"kind":        "list",
			"elementType": typeToJSON(elemType),
		}
	case *exprpb.Type_MapType_:
		mapType := exprType.GetMapType()
		return map[string]interface{}{
			"kind":      "map",
			"keyType":   typeToJSON(mapType.GetKeyType()),
			"valueType": typeToJSON(mapType.GetValueType()),
		}
	case *exprpb.Type_Null:
		return "null"
	case *exprpb.Type_Dyn:
		return "dyn"
	}

	// Fallback to dynamic type
	return "dyn"
}

// ValueToJSON converts a CEL ref.Val to a JSON-serializable value
func ValueToJSON(val ref.Val) interface{} {
	if val == nil {
		return nil
	}

	// Handle null values explicitly
	if val == types.NullValue {
		return nil
	}

	switch v := val.(type) {
	case *types.Optional:
		// Handle CEL optional types properly
		if v.HasValue() {
			// Recursively convert the wrapped value
			return ValueToJSON(v.GetValue())
		} else {
			// Optional with no value (optional.none())
			return nil
		}
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
		// For other unknown types, convert to string
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

// UnregisterFunctionCaller is an interface for unregistering functions
// This allows the cel package to clean up function registrations
type UnregisterFunctionCaller interface {
	UnregisterFunction(implID string)
}

// Global variable to hold the unregister function caller
// This is set by the WASM layer
var unregisterFunctionCaller UnregisterFunctionCaller

// SetUnregisterFunctionCaller sets the unregister function caller
// This is called from the WASM layer
func SetUnregisterFunctionCaller(caller UnregisterFunctionCaller) {
	unregisterFunctionCaller = caller
}

// unregisterFunctionIfUnused unregisters a function if its reference count reaches 0
func unregisterFunctionIfUnused(implID string) {
	ref, ok := functionRefs[implID]
	if !ok {
		return
	}

	if ref.refCount <= 0 {
		// Unregister the function
		if unregisterFunctionCaller != nil {
			unregisterFunctionCaller.UnregisterFunction(implID)
		}
		// Remove from function refs tracking
		delete(functionRefs, implID)
	}
}

// DestroyEnv destroys an environment and marks it as destroyed
// Functions are not immediately unregistered - they will be unregistered
// when all programs using them are destroyed (reference counting)
// However, if no programs exist (all ref counts are 0), cleanup happens immediately
func DestroyEnv(envID string) map[string]interface{} {
	envState, ok := envs[envID]
	if !ok {
		return map[string]interface{}{
			"error": fmt.Sprintf("environment not found: %s", envID),
		}
	}

	// Mark environment as destroyed (prevents new programs from being created)
	envState.destroyed = true

	// OPTIMIZATION: Check if we can clean up immediately.
	// If no programs exist, the refCount for all functions will be 0.
	canCleanupImmediately := true
	for _, implID := range envState.implIDs {
		if ref, ok := functionRefs[implID]; ok {
			if ref.refCount > 0 {
				canCleanupImmediately = false
				break
			}
		}
	}

	if canCleanupImmediately {
		// No programs exist, so we can safely unregister everything now
		for _, implID := range envState.implIDs {
			unregisterFunctionIfUnused(implID)
		}
		delete(envs, envID)
	}

	return map[string]interface{}{
		"success": true,
		"error":   nil,
	}
}

// DestroyProgram destroys a compiled program
// This should be called when a program is no longer needed
// Decrements reference counts for functions and unregisters them if no longer needed
func DestroyProgram(programID string) map[string]interface{} {
	programState, ok := programs[programID]
	if !ok {
		return map[string]interface{}{
			"error": fmt.Sprintf("program not found: %s", programID),
		}
	}

	// Store envID before deleting the program
	envID := programState.envID

	// Remove program from registry FIRST (before checking for remaining programs)
	delete(programs, programID)

	// Get the environment that created this program
	envState, envExists := envs[envID]
	if envExists {
		// Decrement reference counts for all functions in the environment
		for _, implID := range envState.implIDs {
			if ref, ok := functionRefs[implID]; ok {
				ref.refCount--
				// Unregister function if no longer needed
				unregisterFunctionIfUnused(implID)
			}
		}

		// If environment is destroyed and this was the last program using it,
		// we can clean up the environment entry
		// Check if there are any remaining programs using this environment
		hasRemainingPrograms := false
		for _, prog := range programs {
			if prog.envID == envID {
				hasRemainingPrograms = true
				break
			}
		}

		// If environment is destroyed and no programs remain, remove it
		if envState.destroyed && !hasRemainingPrograms {
			delete(envs, envID)
		}
	}

	return map[string]interface{}{
		"success": true,
		"error":   nil,
	}
}
