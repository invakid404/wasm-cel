package main

import (
	"testing"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/checker/decls"
)

// Test basic arithmetic expression
func TestBasicArithmetic(t *testing.T) {
	env, err := cel.NewEnv()
	if err != nil {
		t.Fatalf("failed to create environment: %v", err)
	}

	ast, issues := env.Compile("10 + 20")
	if issues != nil && issues.Err() != nil {
		t.Fatalf("compilation error: %v", issues.Err())
	}

	prg, err := env.Program(ast)
	if err != nil {
		t.Fatalf("failed to create program: %v", err)
	}

	out, _, err := prg.Eval(map[string]interface{}{})
	if err != nil {
		t.Fatalf("evaluation error: %v", err)
	}

	result := celValueToJSON(out)
	if result != int64(30) {
		t.Errorf("expected 30, got %v", result)
	}
}

// Test expression with variables
func TestExpressionWithVariables(t *testing.T) {
	env, err := cel.NewEnv(
		cel.Declarations(
			decls.NewVar("x", decls.Int),
			decls.NewVar("y", decls.Int),
		),
	)
	if err != nil {
		t.Fatalf("failed to create environment: %v", err)
	}

	ast, issues := env.Compile("x + y")
	if issues != nil && issues.Err() != nil {
		t.Fatalf("compilation error: %v", issues.Err())
	}

	prg, err := env.Program(ast)
	if err != nil {
		t.Fatalf("failed to create program: %v", err)
	}

	vars := map[string]interface{}{
		"x": 10,
		"y": 20,
	}
	out, _, err := prg.Eval(vars)
	if err != nil {
		t.Fatalf("evaluation error: %v", err)
	}

	result := celValueToJSON(out)
	if result != int64(30) {
		t.Errorf("expected 30, got %v", result)
	}
}

// Test error case - invalid expression
func TestErrorCase(t *testing.T) {
	env, err := cel.NewEnv()
	if err != nil {
		t.Fatalf("failed to create environment: %v", err)
	}

	ast, issues := env.Compile("x + y")
	if issues != nil && issues.Err() != nil {
		// This is expected - x and y are not declared
		return
	}

	prg, err := env.Program(ast)
	if err != nil {
		// This is also acceptable
		return
	}

	// If we get here, try to evaluate without variables
	_, _, err = prg.Eval(map[string]interface{}{})
	if err == nil {
		t.Error("expected error for undefined variables, got nil")
	}
}

// Test complex expression with string operations
func TestComplexExpression(t *testing.T) {
	env, err := cel.NewEnv(
		cel.Declarations(
			decls.NewVar("name", decls.String),
			decls.NewVar("age", decls.Int),
		),
	)
	if err != nil {
		t.Fatalf("failed to create environment: %v", err)
	}

	ast, issues := env.Compile(`name + " is " + string(age) + " years old"`)
	if issues != nil && issues.Err() != nil {
		t.Fatalf("compilation error: %v", issues.Err())
	}

	prg, err := env.Program(ast)
	if err != nil {
		t.Fatalf("failed to create program: %v", err)
	}

	vars := map[string]interface{}{
		"name": "Alice",
		"age":  30,
	}
	out, _, err := prg.Eval(vars)
	if err != nil {
		t.Fatalf("evaluation error: %v", err)
	}

	result := celValueToJSON(out)
	expected := "Alice is 30 years old"
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

// Test comparison expression
func TestComparisonExpression(t *testing.T) {
	env, err := cel.NewEnv(
		cel.Declarations(
			decls.NewVar("x", decls.Int),
			decls.NewVar("y", decls.Int),
		),
	)
	if err != nil {
		t.Fatalf("failed to create environment: %v", err)
	}

	ast, issues := env.Compile("x > y")
	if issues != nil && issues.Err() != nil {
		t.Fatalf("compilation error: %v", issues.Err())
	}

	prg, err := env.Program(ast)
	if err != nil {
		t.Fatalf("failed to create program: %v", err)
	}

	vars := map[string]interface{}{
		"x": 10,
		"y": 5,
	}
	out, _, err := prg.Eval(vars)
	if err != nil {
		t.Fatalf("evaluation error: %v", err)
	}

	result := celValueToJSON(out)
	if result != true {
		t.Errorf("expected true, got %v", result)
	}
}

// Test list operations
func TestListOperations(t *testing.T) {
	env, err := cel.NewEnv(
		cel.Declarations(
			decls.NewVar("myList", decls.NewListType(decls.Int)),
		),
	)
	if err != nil {
		t.Fatalf("failed to create environment: %v", err)
	}

	ast, issues := env.Compile("myList.size()")
	if issues != nil && issues.Err() != nil {
		t.Fatalf("compilation error: %v", issues.Err())
	}

	prg, err := env.Program(ast)
	if err != nil {
		t.Fatalf("failed to create program: %v", err)
	}

	vars := map[string]interface{}{
		"myList": []interface{}{1, 2, 3, 4, 5},
	}
	out, _, err := prg.Eval(vars)
	if err != nil {
		t.Fatalf("evaluation error: %v", err)
	}

	result := celValueToJSON(out)
	if result != int64(5) {
		t.Errorf("expected 5, got %v", result)
	}
}

// Test the EvaluateCELCore function directly
func TestEvaluateCELCore(t *testing.T) {
	result := EvaluateCELCore("x + y", map[string]interface{}{
		"x": 10,
		"y": 20,
	})

	if result["error"] != nil {
		t.Errorf("unexpected error: %v", result["error"])
	}

	if result["result"] != int64(30) {
		t.Errorf("expected 30, got %v", result["result"])
	}
}

// Test EvaluateCELCore with error case
func TestEvaluateCELCoreError(t *testing.T) {
	result := EvaluateCELCore("x + y", map[string]interface{}{})

	if result["error"] == nil {
		t.Error("expected error for undefined variables, got nil")
	}
}
