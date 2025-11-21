package options

import (
	"fmt"
	"strings"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/ast"
	"github.com/google/cel-go/common/types/ref"
	"github.com/invakid404/wasm-cel/internal/common"
)

// JSFunctionCaller interface for calling JavaScript functions
// This avoids import cycles by defining the interface locally
type JSFunctionCaller interface {
	CallJSFunction(implID string, args []interface{}) (interface{}, error)
}

// Use common types to avoid duplication
type CompilationIssueAdder = common.CompilationIssueAdder
type ValidatorIssue = common.ValidatorIssue

// Global JS function caller - will be set by the WASM layer
var jsFunctionCaller JSFunctionCaller

// SetJSFunctionCaller sets the JavaScript function caller for AST validators
func SetJSFunctionCaller(caller JSFunctionCaller) {
	jsFunctionCaller = caller
}

// GetCompilationContext retrieves a compilation context by ID (filename side-channel approach)
// This function will be implemented by the cel package
var getCompilationContextFunc func(string) CompilationIssueAdder

// SetGetCompilationContextFunc sets the function to retrieve compilation contexts
func SetGetCompilationContextFunc(fn func(string) CompilationIssueAdder) {
	getCompilationContextFunc = fn
}

// ASTValidatorFromJSConfig represents the configuration for JavaScript-based AST validators
type ASTValidatorFromJSConfig struct {
	ValidatorFunctionIds []string `json:"validatorFunctionIds"`
	FailOnWarning        bool     `json:"failOnWarning"`
	IncludeWarnings      bool     `json:"includeWarnings"`
}

// JSValidationIssue represents a validation issue from JavaScript
type JSValidationIssue struct {
	Severity string                 `json:"severity"`
	Message  string                 `json:"message"`
	Location map[string]interface{} `json:"location,omitempty"`
}

// JSValidationIssueWithID represents a validation issue with its associated AST node ID
type JSValidationIssueWithID struct {
	JSValidationIssue
	NodeID int64
}

// JSValidationContext provides context for JavaScript validators
type JSValidationContext struct {
	issuesWithID []JSValidationIssueWithID
	source       string
	contextData  map[string]interface{}
}

// AddIssueWithID adds a validation issue with its associated AST node ID
func (ctx *JSValidationContext) AddIssueWithID(issue JSValidationIssueWithID) {
	ctx.issuesWithID = append(ctx.issuesWithID, issue)
}

// GetSource returns the source expression
func (ctx *JSValidationContext) GetSource() string {
	return ctx.source
}

// GetContextData returns additional context data
func (ctx *JSValidationContext) GetContextData() map[string]interface{} {
	return ctx.contextData
}

// GetIssuesWithID returns all collected issues with their node IDs
func (ctx *JSValidationContext) GetIssuesWithID() []JSValidationIssueWithID {
	return ctx.issuesWithID
}

// JSASTValidator implements cel.ASTValidator using JavaScript functions
type JSASTValidator struct {
	validatorFunctionIds []string
	failOnWarning        bool
	includeWarnings      bool
}

// Name returns the name of this validator
func (v *JSASTValidator) Name() string {
	return "JSASTValidator"
}

// Validate validates an AST using JavaScript validator functions
func (v *JSASTValidator) Validate(env *cel.Env, config cel.ValidatorConfig, a *ast.AST, issues *cel.Issues) {
	if len(v.validatorFunctionIds) == 0 {
		return
	}

	// Use the filename side-channel approach to retrieve the compilation context
	var compilationCollector CompilationIssueAdder

	// Get the compilation ID from the source description (filename side-channel)
	if sourceInfo := a.SourceInfo(); sourceInfo != nil {
		compilationID := sourceInfo.Description()
		if getCompilationContextFunc != nil {
			compilationCollector = getCompilationContextFunc(compilationID)
		}
	}

	// Create validation context
	ctx := &JSValidationContext{
		issuesWithID: []JSValidationIssueWithID{},
		source:       "<expression>", // Source content is not directly accessible from SourceInfo
		contextData:  make(map[string]interface{}),
	}

	// Set source content (SourceInfo doesn't directly expose the original text)
	ctx.source = "<expression>"

	// Traverse the AST and call validators for each node
	v.traverseExpr(a.Expr(), ctx, a.SourceInfo())

	// Process collected issues and add them to CEL issues and compilation collector
	v.processIssues(ctx, issues, compilationCollector)
}

// traverseExpr recursively traverses the AST and calls validators for each expression node
func (v *JSASTValidator) traverseExpr(expr ast.Expr, ctx *JSValidationContext, sourceInfo *ast.SourceInfo) {
	if expr == nil {
		return
	}

	// Get node type and data for this expression
	nodeType := v.getNodeType(expr)
	nodeData := v.extractNodeData(expr, sourceInfo)
	nodeID := expr.ID()

	// Call each JavaScript validator function for this node
	for _, functionId := range v.validatorFunctionIds {
		if jsFunctionCaller != nil {
			// Create a simple JavaScript-compatible context object with just data
			jsContext := map[string]interface{}{
				"source":      ctx.GetSource(),
				"contextData": ctx.GetContextData(),
			}

			args := []interface{}{nodeType, nodeData, jsContext}
			result, err := jsFunctionCaller.CallJSFunction(functionId, args)
			if err != nil {
				// Add validation error for failed validator call with proper node ID
				ctx.AddIssueWithID(JSValidationIssueWithID{
					JSValidationIssue: JSValidationIssue{
						Severity: "error",
						Message:  fmt.Sprintf("Validator function %s failed: %v", functionId, err),
					},
					NodeID: nodeID,
				})
			} else {
				// Check if the result contains issues to add
				if resultMap, ok := result.(map[string]interface{}); ok {
					if issues, ok := resultMap["issues"].([]interface{}); ok {
						for _, issueInterface := range issues {
							if issueMap, ok := issueInterface.(map[string]interface{}); ok {
								jsIssue := JSValidationIssue{
									Severity: getStringFromMap(issueMap, "severity"),
									Message:  getStringFromMap(issueMap, "message"),
								}
								if location, ok := issueMap["location"].(map[string]interface{}); ok {
									jsIssue.Location = location
								}
								// Add issue with proper node ID
								ctx.AddIssueWithID(JSValidationIssueWithID{
									JSValidationIssue: jsIssue,
									NodeID:            nodeID,
								})
							}
						}
					}
				}
			}
		}
	}

	// Recursively traverse child expressions based on expression kind
	switch expr.Kind() {
	case ast.CallKind:
		call := expr.AsCall()
		// Traverse target expression (for method calls)
		if call.Target() != nil {
			v.traverseExpr(call.Target(), ctx, sourceInfo)
		}
		// Traverse all arguments
		for _, arg := range call.Args() {
			v.traverseExpr(arg, ctx, sourceInfo)
		}

	case ast.SelectKind:
		sel := expr.AsSelect()
		// Traverse the operand expression
		v.traverseExpr(sel.Operand(), ctx, sourceInfo)

	case ast.ListKind:
		list := expr.AsList()
		// Traverse all list elements
		for _, elem := range list.Elements() {
			v.traverseExpr(elem, ctx, sourceInfo)
		}

	case ast.MapKind:
		mapExpr := expr.AsMap()
		// Traverse all map entries
		for _, entry := range mapExpr.Entries() {
			// Check if it's a map entry and cast appropriately
			if entry.Kind() == ast.MapEntryKind {
				mapEntry := entry.AsMapEntry()
				v.traverseExpr(mapEntry.Key(), ctx, sourceInfo)
				v.traverseExpr(mapEntry.Value(), ctx, sourceInfo)
			}
		}

	case ast.StructKind:
		structExpr := expr.AsStruct()
		// Traverse all struct fields
		for _, field := range structExpr.Fields() {
			// Check if it's a struct field and cast appropriately
			if field.Kind() == ast.StructFieldKind {
				structField := field.AsStructField()
				v.traverseExpr(structField.Value(), ctx, sourceInfo)
			}
		}

	case ast.ComprehensionKind:
		comp := expr.AsComprehension()
		// Traverse comprehension expressions
		v.traverseExpr(comp.IterRange(), ctx, sourceInfo)
		v.traverseExpr(comp.AccuInit(), ctx, sourceInfo)
		v.traverseExpr(comp.LoopCondition(), ctx, sourceInfo)
		v.traverseExpr(comp.LoopStep(), ctx, sourceInfo)
		v.traverseExpr(comp.Result(), ctx, sourceInfo)

	case ast.IdentKind, ast.LiteralKind:
		// Leaf nodes - no children to traverse
		break
	}
}

// getNodeType returns the string representation of the expression node type
func (v *JSASTValidator) getNodeType(expr ast.Expr) string {
	switch expr.Kind() {
	case ast.CallKind:
		return "call"
	case ast.SelectKind:
		return "select"
	case ast.IdentKind:
		return "ident"
	case ast.LiteralKind:
		return "literal"
	case ast.ListKind:
		return "list"
	case ast.MapKind:
		return "map"
	case ast.StructKind:
		return "struct"
	case ast.ComprehensionKind:
		return "comprehension"
	default:
		return "unknown"
	}
}

// extractNodeData extracts relevant data from an expression node for JavaScript validators
func (v *JSASTValidator) extractNodeData(expr ast.Expr, sourceInfo *ast.SourceInfo) map[string]interface{} {
	data := make(map[string]interface{})
	data["id"] = expr.ID()

	// Add location information if available
	if sourceInfo != nil {
		if location := sourceInfo.GetStartLocation(expr.ID()); location != nil {
			data["location"] = map[string]interface{}{
				"line":   location.Line(),
				"column": location.Column() + 1, // Convert from 0-based to 1-based column
			}
		}
	}

	switch expr.Kind() {
	case ast.CallKind:
		call := expr.AsCall()
		data["function"] = call.FunctionName()
		data["argCount"] = len(call.Args())
		if call.Target() != nil {
			data["hasTarget"] = true
		}

	case ast.SelectKind:
		sel := expr.AsSelect()
		data["field"] = sel.FieldName()
		data["testOnly"] = sel.IsTestOnly()

	case ast.IdentKind:
		data["name"] = expr.AsIdent()

	case ast.LiteralKind:
		literal := expr.AsLiteral()
		data["value"] = v.convertCELValueToInterface(literal)
		data["type"] = literal.Type().TypeName()

	case ast.ListKind:
		list := expr.AsList()
		data["elementCount"] = len(list.Elements())

	case ast.MapKind:
		mapExpr := expr.AsMap()
		data["entryCount"] = len(mapExpr.Entries())

	case ast.StructKind:
		structExpr := expr.AsStruct()
		data["typeName"] = structExpr.TypeName()
		data["fieldCount"] = len(structExpr.Fields())

	case ast.ComprehensionKind:
		comp := expr.AsComprehension()
		data["iterVar"] = comp.IterVar()
		data["accuVar"] = comp.AccuVar()
	}

	return data
}

// convertCELValueToInterface converts a CEL ref.Val to a Go interface{} for JavaScript
func (v *JSASTValidator) convertCELValueToInterface(val ref.Val) interface{} {
	if val == nil {
		return nil
	}

	// Convert based on CEL type
	switch val.Type().TypeName() {
	case "bool":
		if boolVal, ok := val.Value().(bool); ok {
			return boolVal
		}
	case "int":
		if intVal, ok := val.Value().(int64); ok {
			return intVal
		}
	case "uint":
		if uintVal, ok := val.Value().(uint64); ok {
			return uintVal
		}
	case "double":
		if doubleVal, ok := val.Value().(float64); ok {
			return doubleVal
		}
	case "string":
		if strVal, ok := val.Value().(string); ok {
			return strVal
		}
	case "bytes":
		if bytesVal, ok := val.Value().([]byte); ok {
			return string(bytesVal)
		}
	}

	// Fallback to string representation
	return val.Value()
}

// processIssues converts JavaScript validation issues to CEL issues and collects them for detailed API
func (v *JSASTValidator) processIssues(ctx *JSValidationContext, issues *cel.Issues, compilationCollector CompilationIssueAdder) {
	// Process all issues with node IDs
	for _, issueWithID := range ctx.GetIssuesWithID() {
		issue := issueWithID.JSValidationIssue
		nodeID := issueWithID.NodeID

		// Skip warnings if not included
		if !v.includeWarnings && strings.ToLower(issue.Severity) == "warning" {
			continue
		}

		// Add to compilation issue collector for detailed API (always preserve original severity)
		// Only collect warnings and info messages - errors are handled by CEL's native error handling
		if compilationCollector != nil && strings.ToLower(issue.Severity) != "error" {
			validatorIssue := ValidatorIssue{
				Severity: issue.Severity, // Preserve original severity even if failOnWarning converts it to error
				Message:  issue.Message,
				Location: issue.Location,
			}
			compilationCollector.AddValidatorIssue(validatorIssue)
		}

		// Create CEL issue message
		message := issue.Message
		if issue.Location != nil {
			if line, ok := issue.Location["line"].(float64); ok {
				if col, ok := issue.Location["column"].(float64); ok {
					message = fmt.Sprintf("%s (line %d, col %d)", message, int(line), int(col))
				}
			}
		}

		// Report error to CEL issues with proper node ID
		// Note: CEL Issues doesn't have a direct way to add warnings, so we treat everything as errors
		// Only report to CEL if it's an error OR if failOnWarning is true (treating warnings as errors)
		if strings.ToLower(issue.Severity) == "error" || v.failOnWarning {
			issues.ReportErrorAtID(nodeID, message)
		}
	}
}

// getStringFromMap safely extracts a string value from a map
func getStringFromMap(m map[string]interface{}, key string) string {
	if val, ok := m[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

// FromJSON configures the ASTValidatorsBuilder from JSON parameters
func (b *ASTValidatorsBuilder) FromJSON(params map[string]interface{}) error {
	// Parse validator function IDs
	validatorFunctionIds, ok := params["validatorFunctionIds"].([]interface{})
	if !ok {
		return fmt.Errorf("validatorFunctionIds must be an array")
	}

	var functionIds []string
	for _, id := range validatorFunctionIds {
		if strId, ok := id.(string); ok {
			functionIds = append(functionIds, strId)
		} else {
			return fmt.Errorf("validator function ID must be a string")
		}
	}

	// Parse configuration options
	failOnWarning := true
	if val, ok := params["failOnWarning"].(bool); ok {
		failOnWarning = val
	}

	includeWarnings := true
	if val, ok := params["includeWarnings"].(bool); ok {
		includeWarnings = val
	}

	// Create the JavaScript-based AST validator
	validator := &JSASTValidator{
		validatorFunctionIds: functionIds,
		failOnWarning:        failOnWarning,
		includeWarnings:      includeWarnings,
	}

	// Set the validator on the builder
	b.Validators = []cel.ASTValidator{validator}

	return nil
}
