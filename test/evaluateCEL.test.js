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
});
