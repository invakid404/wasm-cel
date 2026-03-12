import { Env } from "../dist/index.js";

describe("CEL Evaluation", () => {
  describe("Basic arithmetic", () => {
    test("should evaluate simple addition", async () => {
      const env = await Env.new();
      const program = await env.compile("10 + 20");
      const result = await program.eval();
      expect(result).toBe(30);
    });

    test("should handle operator precedence", async () => {
      const env = await Env.new();
      const program = await env.compile("10 + 20 * 2");
      const result = await program.eval();
      expect(result).toBe(50);
    });
  });

  describe("Expressions with variables", () => {
    test("should evaluate expression with variables", async () => {
      const env = await Env.new({
        variables: [
          { name: "x", type: "int" },
          { name: "y", type: "int" },
        ],
      });
      const program = await env.compile("x + y");
      const result = await program.eval({ x: 10, y: 20 });
      expect(result).toBe(30);
    });

    test("should reuse program with different variables", async () => {
      const env = await Env.new({
        variables: [
          { name: "x", type: "double" },
          { name: "y", type: "double" },
        ],
      });
      const program = await env.compile("x + y");

      const result1 = await program.eval({ x: 10, y: 20 });
      expect(result1).toBe(30);

      const result2 = await program.eval({ x: 5, y: 15 });
      expect(result2).toBe(20);
    });

    test("should compile multiple expressions with same env", async () => {
      const env = await Env.new({
        variables: [
          { name: "x", type: "double" },
          { name: "y", type: "double" },
        ],
      });

      const program1 = await env.compile("x + y");
      const program2 = await env.compile("x * y");

      const result1 = await program1.eval({ x: 10, y: 20 });
      const result2 = await program2.eval({ x: 10, y: 20 });

      expect(result1).toBe(30);
      expect(result2).toBe(200);
    });

    test("should handle missing variables and throw error", async () => {
      const env = await Env.new({
        variables: [
          { name: "x", type: "double" },
          { name: "y", type: "double" },
        ],
      });
      const program = await env.compile("x + y");
      await expect(program.eval({ x: 10 })).rejects.toThrow();
    });
  });

  describe("String operations", () => {
    test("should concatenate strings with variables", async () => {
      const env = await Env.new({
        variables: [
          { name: "name", type: "string" },
          { name: "age", type: "double" },
        ],
      });
      const program = await env.compile(
        'name + " is " + string(age) + " years old"',
      );
      const result = await program.eval({
        name: "Alice",
        age: 30,
      });
      expect(result).toBe("Alice is 30 years old");
    });
  });

  describe("Comparison expressions", () => {
    test("should evaluate greater than comparison", async () => {
      const env = await Env.new({
        variables: [
          { name: "x", type: "double" },
          { name: "y", type: "double" },
        ],
      });
      const program = await env.compile("x > y");
      const result = await program.eval({ x: 10, y: 5 });
      expect(result).toBe(true);
    });

    test("should evaluate less than comparison", async () => {
      const env = await Env.new({
        variables: [
          { name: "x", type: "double" },
          { name: "y", type: "double" },
        ],
      });
      const program = await env.compile("x < y");
      const result = await program.eval({ x: 5, y: 10 });
      expect(result).toBe(true);
    });

    test("should evaluate equality comparison", async () => {
      const env = await Env.new({
        variables: [
          { name: "x", type: "double" },
          { name: "y", type: "double" },
        ],
      });
      const program = await env.compile("x == y");
      const result = await program.eval({ x: 10, y: 10 });
      expect(result).toBe(true);
    });
  });

  describe("Ternary expressions", () => {
    test("should return first branch when condition is true", async () => {
      const env = await Env.new({
        variables: [
          { name: "x", type: "double" },
          { name: "y", type: "double" },
        ],
      });
      const program = await env.compile('x > y ? "greater" : "lesser"');
      const result = await program.eval({
        x: 10,
        y: 5,
      });
      expect(result).toBe("greater");
    });

    test("should return second branch when condition is false", async () => {
      const env = await Env.new({
        variables: [
          { name: "x", type: "double" },
          { name: "y", type: "double" },
        ],
      });
      const program = await env.compile('x > y ? "greater" : "lesser"');
      const result = await program.eval({
        x: 5,
        y: 10,
      });
      expect(result).toBe("lesser");
    });
  });

  describe("List operations", () => {
    test("should get list size", async () => {
      const env = await Env.new({
        variables: [
          { name: "myList", type: { kind: "list", elementType: "dyn" } },
        ],
      });
      const program = await env.compile("myList.size()");
      const result = await program.eval({
        myList: [1, 2, 3, 4, 5],
      });
      expect(result).toBe(5);
    });

    test("should check if list is empty", async () => {
      const env = await Env.new({
        variables: [
          { name: "myList", type: { kind: "list", elementType: "dyn" } },
        ],
      });
      const program = await env.compile("myList.size() > 0");
      const result = await program.eval({
        myList: [1, 2, 3],
      });
      expect(result).toBe(true);
    });
  });

  describe("Map operations", () => {
    test("should access map values by key", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "myMap",
            type: { kind: "map", keyType: "string", valueType: "dyn" },
          },
        ],
      });
      const program = await env.compile('myMap["key"]');
      const result = await program.eval({
        myMap: { key: "value" },
      });
      expect(result).toBe("value");
    });

    test("should handle nested map access", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "user",
            type: { kind: "map", keyType: "string", valueType: "dyn" },
          },
        ],
      });
      const program = await env.compile(
        'user["name"] + " has " + string(user["score"]) + " points"',
      );
      const result = await program.eval({
        user: { name: "Bob", score: 100 },
      });
      expect(result).toBe("Bob has 100 points");
    });
  });

  describe("Boolean logic", () => {
    test("should evaluate AND expressions", async () => {
      const env = await Env.new({
        variables: [
          { name: "x", type: "double" },
          { name: "y", type: "double" },
        ],
      });
      const program = await env.compile("x > 0.0 && y > 0.0");
      const result = await program.eval({
        x: 5,
        y: 10,
      });
      expect(result).toBe(true);
    });

    test("should evaluate OR expressions", async () => {
      const env = await Env.new({
        variables: [
          { name: "x", type: "double" },
          { name: "y", type: "double" },
        ],
      });
      const program = await env.compile("x > 0.0 || y > 0.0");
      const result = await program.eval({
        x: -5,
        y: 10,
      });
      expect(result).toBe(true);
    });

    test("should evaluate complex boolean expressions", async () => {
      const env = await Env.new({
        variables: [
          { name: "x", type: "double" },
          { name: "y", type: "double" },
          { name: "z", type: "double" },
        ],
      });
      const program = await env.compile("(x > 0.0 && y > 0.0) || z > 100.0");
      const result = await program.eval({
        x: 5,
        y: 10,
        z: 50,
      });
      expect(result).toBe(true);
    });
  });

  describe("Error handling", () => {
    test("should throw error for invalid expressions", async () => {
      const env = await Env.new();
      await expect(env.compile("invalid syntax !!!")).rejects.toThrow();
    });

    test("should throw error for undeclared variables at compile time", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "double" }],
      });

      // This should fail at compile time, not evaluation time
      await expect(env.compile("x + y")).rejects.toThrow();
    });

    test("should throw error when required variables are missing", async () => {
      const env = await Env.new({
        variables: [
          { name: "x", type: "double" },
          { name: "y", type: "double" },
        ],
      });
      const program = await env.compile("x + y");
      await expect(program.eval({ x: 10 })).rejects.toThrow();
    });

    test("should handle null variables object", async () => {
      const env = await Env.new();
      const program = await env.compile("10 + 20");
      const result = await program.eval(null);
      expect(result).toBe(30);
    });
  });

  describe("Int/uint type coercion from JS numbers", () => {
    test("string(int_var) should work", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "int" }],
      });
      const program = await env.compile("string(x)");
      const result = await program.eval({ x: 42 });
      expect(result).toBe("42");
    });

    test("int(int_var) should work (identity cast)", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "int" }],
      });
      const program = await env.compile("int(x)");
      const result = await program.eval({ x: 42 });
      expect(result).toBe(42);
    });

    test("int_var + int literal should work", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "int" }],
      });
      const program = await env.compile("x + 1");
      const result = await program.eval({ x: 10 });
      expect(result).toBe(11);
    });

    test("int_var * int literal should work", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "int" }],
      });
      const program = await env.compile("x * 2");
      const result = await program.eval({ x: 5 });
      expect(result).toBe(10);
    });

    test("double(int_var) should work", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "int" }],
      });
      const program = await env.compile("double(x)");
      const result = await program.eval({ x: 42 });
      expect(result).toBe(42.0);
    });

    test("uint variable with uint() cast should work", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "uint" }],
      });
      const program = await env.compile("uint(x)");
      const result = await program.eval({ x: 42 });
      expect(result).toBe(42);
    });

    test("int_var with ternary should work", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "int" }],
      });
      const program = await env.compile("x > 0 ? x : -x");
      const result = await program.eval({ x: -5 });
      expect(result).toBe(5);
    });

    test("negative int value should coerce correctly", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "int" }],
      });
      const program = await env.compile("string(x)");
      const result = await program.eval({ x: -7 });
      expect(result).toBe("-7");
    });

    test("zero int value should coerce correctly", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "int" }],
      });
      const program = await env.compile("x + 1");
      const result = await program.eval({ x: 0 });
      expect(result).toBe(1);
    });

    test("list(int) elements should be coerced", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "nums",
            type: { kind: "list", elementType: "int" },
          },
        ],
      });
      const program = await env.compile("nums[0] + nums[1]");
      const result = await program.eval({ nums: [10, 20] });
      expect(result).toBe(30);
    });

    test("list(int) elements should work with string cast", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "nums",
            type: { kind: "list", elementType: "int" },
          },
        ],
      });
      const program = await env.compile("string(nums[0])");
      const result = await program.eval({ nums: [42] });
      expect(result).toBe("42");
    });

    test("map(string, int) values should be coerced", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "counts",
            type: { kind: "map", keyType: "string", valueType: "int" },
          },
        ],
      });
      const program = await env.compile('counts["a"] + counts["b"]');
      const result = await program.eval({ counts: { a: 3, b: 7 } });
      expect(result).toBe(10);
    });

    test("map(string, int) values should work with string cast", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "counts",
            type: { kind: "map", keyType: "string", valueType: "int" },
          },
        ],
      });
      const program = await env.compile('string(counts["x"])');
      const result = await program.eval({ counts: { x: 99 } });
      expect(result).toBe("99");
    });

    test("list(uint) elements should be coerced", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "vals",
            type: { kind: "list", elementType: "uint" },
          },
        ],
      });
      const program = await env.compile("vals[0] + vals[1]");
      const result = await program.eval({ vals: [5, 15] });
      expect(result).toBe(20);
    });

    test("double variable should not be coerced to int", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "double" }],
      });
      const program = await env.compile("x + 1.5");
      const result = await program.eval({ x: 2.5 });
      expect(result).toBe(4.0);
    });

    test("string variable should not be affected by coercion", async () => {
      const env = await Env.new({
        variables: [{ name: "s", type: "string" }],
      });
      const program = await env.compile('s + " world"');
      const result = await program.eval({ s: "hello" });
      expect(result).toBe("hello world");
    });

    test("mixed int and double variables should each coerce correctly", async () => {
      const env = await Env.new({
        variables: [
          { name: "i", type: "int" },
          { name: "d", type: "double" },
        ],
      });
      const program = await env.compile("double(i) + d");
      const result = await program.eval({ i: 3, d: 0.14 });
      expect(result).toBeCloseTo(3.14);
    });

    test("map(string, map(string, int)) nested values should be coerced", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "nested",
            type: {
              kind: "map",
              keyType: "string",
              valueType: {
                kind: "map",
                keyType: "string",
                valueType: "int",
              },
            },
          },
        ],
      });
      const program = await env.compile('string(nested["a"]["x"])');
      const result = await program.eval({
        nested: { a: { x: 42 } },
      });
      expect(result).toBe("42");
    });

    test("list(list(int)) nested elements should be coerced", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "matrix",
            type: {
              kind: "list",
              elementType: {
                kind: "list",
                elementType: "int",
              },
            },
          },
        ],
      });
      const program = await env.compile("matrix[0][0] + matrix[1][1]");
      const result = await program.eval({
        matrix: [
          [1, 2],
          [3, 4],
        ],
      });
      expect(result).toBe(5);
    });

    test("map(string, list(int)) nested values should be coerced", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "data",
            type: {
              kind: "map",
              keyType: "string",
              valueType: {
                kind: "list",
                elementType: "int",
              },
            },
          },
        ],
      });
      const program = await env.compile('string(data["scores"][0])');
      const result = await program.eval({
        data: { scores: [100, 200] },
      });
      expect(result).toBe("100");
    });

    test("fractional value for int variable should not be silently truncated", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "int" }],
      });
      const program = await env.compile("x + 1");
      // 1.9 is not a valid int - should fail rather than silently become 1
      await expect(program.eval({ x: 1.9 })).rejects.toThrow();
    });

    test("negative value for uint variable should not be coerced", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "uint" }],
      });
      const program = await env.compile("x + 1u");
      // -5 is not a valid uint - should fail rather than produce garbage
      await expect(program.eval({ x: -5 })).rejects.toThrow();
    });

    test("MAX_SAFE_INTEGER (2^53-1) should coerce to int correctly", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "int" }],
      });
      const program = await env.compile("x == x");
      const result = await program.eval({ x: Number.MAX_SAFE_INTEGER });
      expect(result).toBe(true);
    });

    test("2^63 should not be coerced to int (out of range)", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "int" }],
      });
      const program = await env.compile("x + 1");
      // 2^63 overflows int64 - should fail rather than produce undefined behavior
      await expect(program.eval({ x: 2 ** 63 })).rejects.toThrow();
    });

    test("2^64 should not be coerced to uint (out of range)", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "uint" }],
      });
      const program = await env.compile("x + 1u");
      // 2^64 overflows uint64 - should fail rather than produce undefined behavior
      await expect(program.eval({ x: 2 ** 64 })).rejects.toThrow();
    });

    test("NaN should not be coerced to int", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "int" }],
      });
      const program = await env.compile("x + 1");
      await expect(program.eval({ x: NaN })).rejects.toThrow();
    });

    test("Infinity should not be coerced to int", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "int" }],
      });
      const program = await env.compile("x + 1");
      await expect(program.eval({ x: Infinity })).rejects.toThrow();
    });

    test("-Infinity should not be coerced to int", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "int" }],
      });
      const program = await env.compile("x + 1");
      await expect(program.eval({ x: -Infinity })).rejects.toThrow();
    });

    // Note: map-wrapped type forms like { type: "int" } and { name: "uint" }
    // are accepted by Go's parseTypeDef as fallbacks, and coerceValue handles
    // them defensively. However, they are untestable from JS because
    // serializeTypeDef normalizes them to "dyn" before they reach Go.
  });

  describe("Non-string map key type coercion", () => {
    test("map(int, string) should coerce string keys to int", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "m",
            type: { kind: "map", keyType: "int", valueType: "string" },
          },
        ],
      });
      const program = await env.compile('m[1]');
      const result = await program.eval({ m: { 1: "one" } });
      expect(result).toBe("one");
    });

    test("map(int, int) should coerce both keys and values", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "m",
            type: { kind: "map", keyType: "int", valueType: "int" },
          },
        ],
      });
      const program = await env.compile("m[1] + m[2]");
      const result = await program.eval({ m: { 1: 10, 2: 20 } });
      expect(result).toBe(30);
    });

    test("map(uint, string) should coerce string keys to uint", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "m",
            type: { kind: "map", keyType: "uint", valueType: "string" },
          },
        ],
      });
      const program = await env.compile('m[1u]');
      const result = await program.eval({ m: { 1: "one" } });
      expect(result).toBe("one");
    });

    test("map(int, string) should work with string() cast on value", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "m",
            type: { kind: "map", keyType: "int", valueType: "int" },
          },
        ],
      });
      const program = await env.compile("string(m[1])");
      const result = await program.eval({ m: { 1: 42 } });
      expect(result).toBe("42");
    });

    test("map(int, list(int)) should coerce keys and nested values", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "m",
            type: {
              kind: "map",
              keyType: "int",
              valueType: { kind: "list", elementType: "int" },
            },
          },
        ],
      });
      const program = await env.compile("m[1][0] + m[2][0]");
      const result = await program.eval({
        m: { 1: [10], 2: [20] },
      });
      expect(result).toBe(30);
    });

    test("map(string, int) should still work (no key coercion needed)", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "m",
            type: { kind: "map", keyType: "string", valueType: "int" },
          },
        ],
      });
      const program = await env.compile('m["a"] + m["b"]');
      const result = await program.eval({ m: { a: 3, b: 7 } });
      expect(result).toBe(10);
    });
  });

  describe("Timestamp and duration type coercion", () => {
    test("timestamp variable should work with getFullYear", async () => {
      const env = await Env.new({
        variables: [{ name: "t", type: "timestamp" }],
      });
      const program = await env.compile("t.getFullYear()");
      const result = await program.eval({ t: "2024-06-15T10:30:00Z" });
      expect(result).toBe(2024);
    });

    test("timestamp variable should support comparison", async () => {
      const env = await Env.new({
        variables: [
          { name: "a", type: "timestamp" },
          { name: "b", type: "timestamp" },
        ],
      });
      const program = await env.compile("a < b");
      const result = await program.eval({
        a: "2024-01-01T00:00:00Z",
        b: "2025-01-01T00:00:00Z",
      });
      expect(result).toBe(true);
    });

    test("duration variable should support arithmetic", async () => {
      const env = await Env.new({
        variables: [{ name: "d", type: "duration" }],
      });
      const program = await env.compile("d + d");
      const result = await program.eval({ d: "3600s" });
      expect(result).toBe("2h0m0s");
    });

    test("timestamp + duration should work", async () => {
      const env = await Env.new({
        variables: [
          { name: "t", type: "timestamp" },
          { name: "d", type: "duration" },
        ],
      });
      const program = await env.compile("t + d");
      const result = await program.eval({
        t: "2024-01-01T00:00:00Z",
        d: "3600s",
      });
      // Result should be a timestamp string
      expect(typeof result).toBe("string");
    });

    test("invalid timestamp string should be rejected", async () => {
      const env = await Env.new({
        variables: [{ name: "t", type: "timestamp" }],
      });
      const program = await env.compile("t.getFullYear()");
      await expect(
        program.eval({ t: "not-a-timestamp" })
      ).rejects.toThrow();
    });

    test("invalid duration string should be rejected", async () => {
      const env = await Env.new({
        variables: [{ name: "d", type: "duration" }],
      });
      const program = await env.compile("d + d");
      await expect(program.eval({ d: "invalid" })).rejects.toThrow();
    });
  });
});
