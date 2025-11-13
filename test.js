const assert = require("assert");
const { evaluateCEL } = require("./index.js");

async function runTests() {
  console.log("Running JavaScript tests...\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Basic arithmetic
  try {
    const result = await evaluateCEL("10 + 20");
    assert.strictEqual(result.result, 30, "Basic arithmetic should return 30");
    console.log("✓ Test 1 passed: Basic arithmetic");
    passed++;
  } catch (err) {
    console.error("✗ Test 1 failed: Basic arithmetic");
    console.error("  Error:", err.message);
    failed++;
  }

  // Test 2: Expression with variables
  try {
    const result = await evaluateCEL("x + y", { x: 10, y: 20 });
    assert.strictEqual(
      result.result,
      30,
      "Expression with variables should return 30",
    );
    console.log("✓ Test 2 passed: Expression with variables");
    passed++;
  } catch (err) {
    console.error("✗ Test 2 failed: Expression with variables");
    console.error("  Error:", err.message);
    failed++;
  }

  // Test 3: Error case - invalid expression
  try {
    await evaluateCEL("x + y"); // x and y not provided
    console.error("✗ Test 3 failed: Error case - should have thrown an error");
    failed++;
  } catch (err) {
    console.log("✓ Test 3 passed: Error case (correctly threw error)");
    passed++;
  }

  // Test 4: Complex expression with string operations
  try {
    const result = await evaluateCEL(
      'name + " is " + string(age) + " years old"',
      {
        name: "Alice",
        age: 30,
      },
    );
    assert.strictEqual(
      result.result,
      "Alice is 30 years old",
      "String concatenation should work",
    );
    console.log("✓ Test 4 passed: Complex expression with strings");
    passed++;
  } catch (err) {
    console.error("✗ Test 4 failed: Complex expression with strings");
    console.error("  Error:", err.message);
    failed++;
  }

  // Test 5: Comparison expression
  try {
    const result = await evaluateCEL("x > y", { x: 10, y: 5 });
    assert.strictEqual(result.result, true, "Comparison should return true");
    console.log("✓ Test 5 passed: Comparison expression");
    passed++;
  } catch (err) {
    console.error("✗ Test 5 failed: Comparison expression");
    console.error("  Error:", err.message);
    failed++;
  }

  // Test 6: Ternary expression
  try {
    const result = await evaluateCEL('x > y ? "greater" : "lesser"', {
      x: 10,
      y: 5,
    });
    assert.strictEqual(
      result.result,
      "greater",
      'Ternary should return "greater"',
    );
    console.log("✓ Test 6 passed: Ternary expression");
    passed++;
  } catch (err) {
    console.error("✗ Test 6 failed: Ternary expression");
    console.error("  Error:", err.message);
    failed++;
  }

  // Test 7: List operations
  try {
    const result = await evaluateCEL("myList.size()", {
      myList: [1, 2, 3, 4, 5],
    });
    assert.strictEqual(result.result, 5, "List size should return 5");
    console.log("✓ Test 7 passed: List operations");
    passed++;
  } catch (err) {
    console.error("✗ Test 7 failed: List operations");
    console.error("  Error:", err.message);
    failed++;
  }

  // Test 8: Map operations
  try {
    const result = await evaluateCEL('myMap["key"]', {
      myMap: { key: "value" },
    });
    assert.strictEqual(
      result.result,
      "value",
      'Map access should return "value"',
    );
    console.log("✓ Test 8 passed: Map operations");
    passed++;
  } catch (err) {
    console.error("✗ Test 8 failed: Map operations");
    console.error("  Error:", err.message);
    failed++;
  }

  console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
