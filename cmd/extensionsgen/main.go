package main

import (
	"fmt"
	"go/ast"
	"go/token"
	"go/types"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/dave/jennifer/jen"
	"golang.org/x/tools/go/packages"
)

const (
	celPackageName = "github.com/google/cel-go/cel"
	envOptionType  = celPackageName + ".EnvOption"
)

type OptionParam struct {
	Name     string
	Type     string
	Variadic bool
}

type OptionInfo struct {
	Name        string
	Params      []OptionParam
	Description string
	Package     string
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--help" {
		fmt.Println("Usage: extensionsgen [output_dir]")
		fmt.Println("Generates CEL environment option structs and interfaces")
		fmt.Println("Default output directory: internal/options")
		os.Exit(0)
	}

	outputDir := "internal/options"
	if len(os.Args) > 1 {
		outputDir = os.Args[1]
	}

	options, err := discoverOptions()
	if err != nil {
		log.Fatalln("failed to discover options:", err)
	}

	if err := generateCode(options, outputDir); err != nil {
		log.Fatalln("failed to generate code:", err)
	}

	fmt.Printf("Generated %d option definitions in %s\n", len(options), outputDir)
}

func discoverOptions() ([]OptionInfo, error) {
	cfg := &packages.Config{
		Mode: packages.NeedTypes | packages.NeedSyntax | packages.NeedImports | packages.NeedName | packages.NeedFiles,
		Fset: token.NewFileSet(),
	}

	pkgs, err := packages.Load(cfg, celPackageName)
	if err != nil {
		return nil, fmt.Errorf("failed to load CEL package: %w", err)
	}

	pkg := pkgs[0]
	scope := pkg.Types.Scope()

	var options []OptionInfo

	for _, name := range scope.Names() {
		obj := scope.Lookup(name)
		if !obj.Exported() {
			continue
		}

		funcObj, ok := obj.(*types.Func)
		if !ok {
			continue
		}

		sig := funcObj.Type().(*types.Signature)

		// Check if function returns EnvOption
		results := sig.Results()
		if results.Len() != 1 || results.At(0).Type().String() != envOptionType {
			continue
		}

		// Extract parameters
		params := extractParams(sig, funcObj.Name())

		// Skip options with complex types that are hard to handle
		skipOption := false
		for _, param := range params {
			if strings.Contains(param.Type, "interface{}") ||
				strings.Contains(param.Type, "any") ||
				strings.Contains(param.Type, "Config") ||
				strings.Contains(param.Type, "ConfigOptionFactory") {
				skipOption = true
				break
			}
		}

		if skipOption {
			fmt.Printf("Skipping complex option: %s\n", funcObj.Name())
			continue
		}

		// Extract documentation
		doc := extractDocumentation(pkg, funcObj)

		options = append(options, OptionInfo{
			Name:        funcObj.Name(),
			Params:      params,
			Description: doc,
			Package:     "cel",
		})
	}

	return options, nil
}

func extractParams(sig *types.Signature, funcName string) []OptionParam {
	params := sig.Params()
	var result []OptionParam

	for i := 0; i < params.Len(); i++ {
		param := params.At(i)
		paramType := param.Type().String()
		paramName := param.Name()

		// Handle variadic parameters
		variadic := false
		if sig.Variadic() && i == params.Len()-1 {
			variadic = true
			// Remove "[]" prefix from slice type for variadic params
			if strings.HasPrefix(paramType, "[]") {
				paramType = paramType[2:]
			}
		}

		// Clean up type names
		paramType = cleanTypeName(paramType)

		// Generate parameter name if not available
		if paramName == "" {
			paramName = fmt.Sprintf("param%d", i+1)
		}


		result = append(result, OptionParam{
			Name:     paramName,
			Type:     paramType,
			Variadic: variadic,
		})
	}

	return result
}

func cleanTypeName(typeName string) string {
	// Remove package prefixes for common types
	replacements := map[string]string{
		"github.com/google/cel-go/cel.":                                     "",
		"github.com/google/cel-go/checker.":                                "",
		"github.com/google/cel-go/common/types.":                           "",
		"github.com/google/cel-go/common/types/ref.":                       "",
		"github.com/google/cel-go/common/decls.":                           "",
		"google.golang.org/genproto/googleapis/api/expr/v1alpha1.":         "",
		"google.golang.org/protobuf/reflect/protoreflect.":                 "",
	}

	for old, new := range replacements {
		typeName = strings.ReplaceAll(typeName, old, new)
	}

	return typeName
}

func extractDocumentation(pkg *packages.Package, funcObj *types.Func) string {
	// Try to find documentation from AST
	for _, file := range pkg.Syntax {
		for _, decl := range file.Decls {
			if funcDecl, ok := decl.(*ast.FuncDecl); ok {
				if funcDecl.Name.Name == funcObj.Name() {
					if funcDecl.Doc != nil {
						return strings.TrimSpace(funcDecl.Doc.Text())
					}
				}
			}
		}
	}
	return ""
}

func generateCode(options []OptionInfo, outputDir string) error {
	// Create output directory
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Generate single consolidated options file
	if err := generateSingleOptionsFile(options, outputDir); err != nil {
		return fmt.Errorf("failed to generate options file: %w", err)
	}

	return nil
}

func generateSingleOptionsFile(options []OptionInfo, outputDir string) error {
	f := jen.NewFile("options")

	// Add package comment
	f.PackageComment("Code generated by extensionsgen. DO NOT EDIT.")

	// Add imports
	f.ImportName("github.com/google/cel-go/cel", "cel")
	f.ImportName("fmt", "fmt")

	// Determine what additional imports we need
	needsChecker := false
	needsTypes := false
	needsRef := false
	needsDecls := false
	needsExpr := false
	needsProto := false
	needsEnv := false

	for _, option := range options {
		for _, param := range option.Params {
			switch {
			case strings.Contains(param.Type, "CostOption"):
				needsChecker = true
			case strings.Contains(param.Type, "Adapter"):
				needsTypes = true
			case strings.Contains(param.Type, "Val"):
				needsRef = true
			case strings.Contains(param.Type, "FunctionDecl") || strings.Contains(param.Type, "VariableDecl"):
				needsDecls = true
			case strings.Contains(param.Type, "Decl"):
				needsExpr = true
			case strings.Contains(param.Type, "proto.Message"):
				needsProto = true
			case strings.Contains(param.Type, "Config"):
				needsEnv = true
			}
		}
	}

	if needsChecker {
		f.ImportName("github.com/google/cel-go/checker", "checker")
	}
	if needsTypes {
		f.ImportName("github.com/google/cel-go/common/types", "types")
		f.ImportName("github.com/google/cel-go/common/types/ref", "ref")
	}
	if needsRef {
		f.ImportName("github.com/google/cel-go/common/types/ref", "ref")
	}
	if needsDecls {
		f.ImportName("github.com/google/cel-go/common/decls", "decls")
	}
	if needsExpr {
		f.ImportName("google.golang.org/genproto/googleapis/api/expr/v1alpha1", "expr")
	}
	if needsProto {
		f.ImportName("google.golang.org/protobuf/proto", "proto")
	}
	if needsEnv {
		f.ImportName("github.com/google/cel-go/common/env", "env")
	}

	// OptionBuilder interface
	f.Comment("OptionBuilder is the interface that all option builders must implement")
	f.Type().Id("OptionBuilder").Interface(
		jen.Comment("Build creates the actual CEL environment option"),
		jen.Id("Build").Params().Params(jen.Qual("github.com/google/cel-go/cel", "EnvOption"), jen.Error()),
		jen.Comment("Name returns the name of the option"),
		jen.Id("Name").Params().String(),
		jen.Comment("Description returns a description of what this option does"),
		jen.Id("Description").Params().String(),
	)

	// FromJSON interface
	f.Comment("FromJSON is the interface that maintainers implement for options they want to expose to WASM")
	f.Type().Id("FromJSON").Interface(
		jen.Comment("FromJSON configures the option builder from JSON parameters"),
		jen.Id("FromJSON").Params(jen.Id("params").Map(jen.String()).Interface()).Error(),
	)

	// Registry struct
	f.Comment("Registry holds all available option builders")
	f.Type().Id("Registry").Struct(
		jen.Id("builders").Map(jen.String()).Func().Params().Id("OptionBuilder"),
	)

	// NewRegistry function
	f.Comment("NewRegistry creates a new option registry")
	f.Func().Id("NewRegistry").Params().Op("*").Id("Registry").Block(
		jen.Return(jen.Op("&").Id("Registry").Values(
			jen.Id("builders").Op(":").Make(jen.Map(jen.String()).Func().Params().Id("OptionBuilder")),
		)),
	)

	// Register method
	f.Comment("Register registers an option builder factory function")
	f.Func().Params(jen.Id("r").Op("*").Id("Registry")).Id("Register").Params(
		jen.Id("name").String(),
		jen.Id("factory").Func().Params().Id("OptionBuilder"),
	).Block(
		jen.Id("r").Dot("builders").Index(jen.Id("name")).Op("=").Id("factory"),
	)

	// Create method
	f.Comment("Create creates a new option builder by name")
	f.Func().Params(jen.Id("r").Op("*").Id("Registry")).Id("Create").Params(
		jen.Id("name").String(),
	).Params(jen.Id("OptionBuilder"), jen.Error()).Block(
		jen.List(jen.Id("factory"), jen.Id("exists")).Op(":=").Id("r").Dot("builders").Index(jen.Id("name")),
		jen.If(jen.Op("!").Id("exists")).Block(
			jen.Return(jen.Nil(), jen.Qual("fmt", "Errorf").Call(jen.Lit("option %q not found"), jen.Id("name"))),
		),
		jen.Return(jen.Id("factory").Call(), jen.Nil()),
	)

	// List method
	f.Comment("List returns all available option names")
	f.Func().Params(jen.Id("r").Op("*").Id("Registry")).Id("List").Params().Index().String().Block(
		jen.Var().Id("names").Index().String(),
		jen.For(jen.Id("name").Op(":=").Range().Id("r").Dot("builders")).Block(
			jen.Id("names").Op("=").Append(jen.Id("names"), jen.Id("name")),
		),
		jen.Return(jen.Id("names")),
	)

	// ListWithFromJSON method - returns only options that implement FromJSON
	f.Comment("ListWithFromJSON returns option names that implement the FromJSON interface")
	f.Func().Params(jen.Id("r").Op("*").Id("Registry")).Id("ListWithFromJSON").Params().Index().String().Block(
		jen.Var().Id("names").Index().String(),
		jen.For(jen.List(jen.Id("name"), jen.Id("factory")).Op(":=").Range().Id("r").Dot("builders")).Block(
			jen.Id("builder").Op(":=").Id("factory").Call(),
			jen.If(jen.List(jen.Id("_"), jen.Id("ok")).Op(":=").Id("builder").Assert(jen.Id("FromJSON")), jen.Id("ok")).Block(
				jen.Id("names").Op("=").Append(jen.Id("names"), jen.Id("name")),
			),
		),
		jen.Return(jen.Id("names")),
	)

	// DefaultRegistry variable
	f.Comment("DefaultRegistry is the default registry with all built-in options")
	f.Var().Id("DefaultRegistry").Op("=").Id("NewRegistry").Call()

	// Generate all option builders
	for _, option := range options {
		generateOptionBuilder(f, option)
	}

	// Write to file
	return f.Save(filepath.Join(outputDir, "options.go"))
}

func generateOptionBuilder(f *jen.File, option OptionInfo) {
	builderName := option.Name + "Builder"

	// Add description comment if available
	if option.Description != "" {
		// Split multiline comments into separate comment lines
		lines := strings.Split(option.Description, "\n")
		for _, line := range lines {
			if strings.TrimSpace(line) != "" {
				f.Comment(strings.TrimSpace(line))
			}
		}
	}

	// Builder struct
	structFields := []jen.Code{}
	for _, param := range option.Params {
		goType := convertToJenType(param.Type, param.Variadic)
		// Avoid naming conflicts with methods by using different field names
		fieldName := strings.Title(param.Name)
		if fieldName == "Name" {
			fieldName = "NameValue"
		}
		structFields = append(structFields, jen.Id(fieldName).Add(goType))
	}

	f.Type().Id(builderName).Struct(structFields...)

	// Name method
	f.Comment("Name returns the name of this option")
	f.Func().Params(jen.Id("b").Op("*").Id(builderName)).Id("Name").Params().String().Block(
		jen.Return(jen.Lit(option.Name)),
	)

	// Description method
	f.Comment("Description returns the description of this option")
	f.Func().Params(jen.Id("b").Op("*").Id(builderName)).Id("Description").Params().String().Block(
		jen.Return(jen.Lit(option.Description)),
	)

	// Setter methods for each parameter
	for _, param := range option.Params {
		methodName := "Set" + strings.Title(param.Name)
		fieldName := strings.Title(param.Name)
		if fieldName == "Name" {
			fieldName = "NameValue"
		}
		goType := convertToJenType(param.Type, param.Variadic)

		f.Comment(fmt.Sprintf("Set%s sets the %s parameter", strings.Title(param.Name), param.Name))
		f.Func().Params(jen.Id("b").Op("*").Id(builderName)).Id(methodName).Params(
			jen.Id(param.Name).Add(goType),
		).Op("*").Id(builderName).Block(
			jen.Id("b").Dot(fieldName).Op("=").Id(param.Name),
			jen.Return(jen.Id("b")),
		)
	}

	// Build method
	f.Comment("Build creates the CEL environment option")
	buildParams := []jen.Code{}
	for _, param := range option.Params {
		fieldName := strings.Title(param.Name)
		if fieldName == "Name" {
			fieldName = "NameValue"
		}
		fieldRef := jen.Id("b").Dot(fieldName)
		if param.Variadic {
			fieldRef = fieldRef.Op("...")
		}
		buildParams = append(buildParams, fieldRef)
	}

	var buildCall *jen.Statement
	if len(buildParams) > 0 {
		buildCall = jen.Qual("github.com/google/cel-go/cel", option.Name).Call(buildParams...)
	} else {
		buildCall = jen.Qual("github.com/google/cel-go/cel", option.Name).Call()
	}

	f.Func().Params(jen.Id("b").Op("*").Id(builderName)).Id("Build").Params().Params(
		jen.Qual("github.com/google/cel-go/cel", "EnvOption"),
		jen.Error(),
	).Block(
		jen.Return(buildCall, jen.Nil()),
	)

	// Generate init function to register this option
	f.Func().Id("init").Params().Block(
		jen.Id("DefaultRegistry").Dot("Register").Call(
			jen.Lit(option.Name),
			jen.Func().Params().Id("OptionBuilder").Block(
				jen.Return(jen.Op("&").Id(builderName).Values()),
			),
		),
	)
}

func convertToJenType(celType string, variadic bool) *jen.Statement {
	var baseType *jen.Statement

	switch celType {
	case "string":
		baseType = jen.String()
	case "bool":
		baseType = jen.Bool()
	case "int":
		baseType = jen.Int()
	case "int64":
		baseType = jen.Int64()
	case "uint64":
		baseType = jen.Uint64()
	case "float64":
		baseType = jen.Float64()
	case "ASTValidator":
		baseType = jen.Qual("github.com/google/cel-go/cel", "ASTValidator")
	case "CostOption":
		baseType = jen.Qual("github.com/google/cel-go/checker", "CostOption")
	case "Adapter":
		baseType = jen.Qual("github.com/google/cel-go/common/types", "Adapter")
	case "Val":
		baseType = jen.Qual("github.com/google/cel-go/common/types/ref", "Val")
	case "Type", "*Type":
		baseType = jen.Op("*").Qual("github.com/google/cel-go/cel", "Type")
	case "Decl", "*Decl":
		baseType = jen.Op("*").Qual("google.golang.org/genproto/googleapis/api/expr/v1alpha1", "Decl")
	case "MessageDescriptor":
		baseType = jen.Qual("google.golang.org/protobuf/reflect/protoreflect", "MessageDescriptor")
	case "Library":
		baseType = jen.Qual("github.com/google/cel-go/cel", "Library")
	case "Macro":
		baseType = jen.Qual("github.com/google/cel-go/cel", "Macro")
	case "OptionalTypesOption":
		baseType = jen.Qual("github.com/google/cel-go/cel", "OptionalTypesOption")
	case "StdLibOption":
		baseType = jen.Qual("github.com/google/cel-go/cel", "StdLibOption")
	case "FunctionDecl", "*FunctionDecl":
		baseType = jen.Op("*").Qual("github.com/google/cel-go/common/decls", "FunctionDecl")
	case "VariableDecl", "*VariableDecl":
		baseType = jen.Op("*").Qual("github.com/google/cel-go/common/decls", "VariableDecl")
	case "ConfigOptionFactory":
		baseType = jen.Qual("github.com/google/cel-go/cel", "ConfigOptionFactory")
	case "FunctionOpt":
		baseType = jen.Qual("github.com/google/cel-go/cel", "FunctionOpt")
	default:
		// Handle complex types
		if strings.Contains(celType, "interface{}") || celType == "any" {
			baseType = jen.Interface()
		} else if strings.Contains(celType, "*") {
			// Handle pointer types like *env.Config
			cleanType := strings.TrimPrefix(celType, "*")
			if strings.Contains(cleanType, ".") {
				parts := strings.Split(cleanType, ".")
				if len(parts) == 2 {
					// Handle qualified types like env.Config
					pkg := parts[0]
					typeName := parts[1]
					
					// Map known package names to full import paths
					pkgMap := map[string]string{
						"env": "github.com/google/cel-go/common/env",
					}
					
					if fullPkg, exists := pkgMap[pkg]; exists {
						baseType = jen.Op("*").Qual(fullPkg, typeName)
					} else {
						// For unknown qualified types, treat as interface{}
						baseType = jen.Interface()
					}
				} else {
					baseType = jen.Op("*").Id(cleanType)
				}
			} else {
				baseType = jen.Op("*").Id(cleanType)
			}
		} else if strings.Contains(celType, ".") {
			// Handle qualified types without pointer
			parts := strings.Split(celType, ".")
			if len(parts) == 2 {
				pkg := parts[0]
				typeName := parts[1]
				
				// Map known package names to full import paths
				pkgMap := map[string]string{
					"env": "github.com/google/cel-go/common/env",
				}
				
				if fullPkg, exists := pkgMap[pkg]; exists {
					baseType = jen.Qual(fullPkg, typeName)
				} else {
					baseType = jen.Id(celType)
				}
			} else {
				baseType = jen.Id(celType)
			}
		} else {
			// Fallback to the original type string
			baseType = jen.Id(celType)
		}
	}

	if variadic {
		return jen.Index().Add(baseType)
	}
	return baseType
}