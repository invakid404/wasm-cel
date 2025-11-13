const { evaluateCEL } = require('./index.js');

async function main() {
  console.log('CEL Expression Evaluator Example\n');
  console.log('=' .repeat(50));

  // Example 1: Basic arithmetic
  console.log('\n1. Basic Arithmetic:');
  try {
    const result1 = await evaluateCEL('10 + 20 * 2');
    console.log('   Expression: 10 + 20 * 2');
    console.log('   Result:', result1.result);
  } catch (err) {
    console.error('   Error:', err.message);
  }

  // Example 2: Expression with variables
  console.log('\n2. Expression with Variables:');
  try {
    const result2 = await evaluateCEL('x + y', { x: 10, y: 20 });
    console.log('   Expression: x + y');
    console.log('   Variables: { x: 10, y: 20 }');
    console.log('   Result:', result2.result);
  } catch (err) {
    console.error('   Error:', err.message);
  }

  // Example 3: Comparison
  console.log('\n3. Comparison:');
  try {
    const result3 = await evaluateCEL('x > y ? "greater" : "lesser"', { x: 10, y: 5 });
    console.log('   Expression: x > y ? "greater" : "lesser"');
    console.log('   Variables: { x: 10, y: 5 }');
    console.log('   Result:', result3.result);
  } catch (err) {
    console.error('   Error:', err.message);
  }

  // Example 4: String operations
  console.log('\n4. String Operations:');
  try {
    const result4 = await evaluateCEL('name + " is " + string(age) + " years old"', {
      name: 'Alice',
      age: 30
    });
    console.log('   Expression: name + " is " + string(age) + " years old"');
    console.log('   Variables: { name: "Alice", age: 30 }');
    console.log('   Result:', result4.result);
  } catch (err) {
    console.error('   Error:', err.message);
  }

  // Example 5: List operations
  console.log('\n5. List Operations:');
  try {
    const result5 = await evaluateCEL('myList.size() > 0', { myList: [1, 2, 3, 4, 5] });
    console.log('   Expression: myList.size() > 0');
    console.log('   Variables: { myList: [1, 2, 3, 4, 5] }');
    console.log('   Result:', result5.result);
  } catch (err) {
    console.error('   Error:', err.message);
  }

  // Example 6: Map operations
  console.log('\n6. Map Operations:');
  try {
    const result6 = await evaluateCEL('user["name"] + " has " + string(user["score"]) + " points"', {
      user: { name: 'Bob', score: 100 }
    });
    console.log('   Expression: user["name"] + " has " + string(user["score"]) + " points"');
    console.log('   Variables: { user: { name: "Bob", score: 100 } }');
    console.log('   Result:', result6.result);
  } catch (err) {
    console.error('   Error:', err.message);
  }

  // Example 7: Complex boolean logic
  console.log('\n7. Complex Boolean Logic:');
  try {
    const result7 = await evaluateCEL('(x > 0 && y > 0) || z > 100', {
      x: 5,
      y: 10,
      z: 50
    });
    console.log('   Expression: (x > 0 && y > 0) || z > 100');
    console.log('   Variables: { x: 5, y: 10, z: 50 }');
    console.log('   Result:', result7.result);
  } catch (err) {
    console.error('   Error:', err.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('Examples completed!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
