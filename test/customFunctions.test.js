import { Env, celFunction, listType } from "../dist/index.js";

describe("Custom Functions", () => {
  describe("Basic function definition and usage", () => {
    test("should define and use a simple addition function", async () => {
      const add = celFunction("add")
        .param("a", "int")
        .param("b", "int")
        .returns("int")
        .implement((a, b) => a + b);

      const env = await Env.new({
        functions: [add],
      });
      const program = await env.compile("add(10, 20)");
      const result = await program.eval();
      expect(result).toBe(30);
    });

    test("should define and use a multiplication function", async () => {
      const multiply = celFunction("multiply")
        .param("a", "int")
        .param("b", "int")
        .returns("int")
        .implement((a, b) => a * b);

      const env = await Env.new({
        functions: [multiply],
      });
      const program = await env.compile("multiply(5, 7)");
      const result = await program.eval();
      expect(result).toBe(35);
    });

    test("should use function with variables", async () => {
      const subtract = celFunction("subtract")
        .param("a", "double")
        .param("b", "double")
        .returns("double")
        .implement((a, b) => Number(a) - Number(b));

      const env = await Env.new({
        variables: [
          { name: "x", type: "double" },
          { name: "y", type: "double" },
        ],
        functions: [subtract],
      });
      const program = await env.compile("subtract(x, y)");
      const result = await program.eval({ x: 100, y: 30 });
      expect(result).toBe(70);
    });
  });

  describe("String functions", () => {
    test("should define and use uppercase function", async () => {
      const uppercase = celFunction("uppercase")
        .param("str", "string")
        .returns("string")
        .implement((str) => String(str).toUpperCase());

      const env = await Env.new({
        functions: [uppercase],
      });
      const program = await env.compile('uppercase("hello world")');
      const result = await program.eval();
      expect(result).toBe("HELLO WORLD");
    });

    test("should define and use lowercase function", async () => {
      const lowercase = celFunction("lowercase")
        .param("str", "string")
        .returns("string")
        .implement((str) => String(str).toLowerCase());

      const env = await Env.new({
        functions: [lowercase],
      });
      const program = await env.compile('lowercase("HELLO WORLD")');
      const result = await program.eval();
      expect(result).toBe("hello world");
    });

    test("should define and use string concatenation function", async () => {
      const concat = celFunction("concat")
        .param("a", "string")
        .param("b", "string")
        .returns("string")
        .implement((a, b) => String(a) + String(b));

      const env = await Env.new({
        functions: [concat],
      });
      const program = await env.compile('concat("foo", "bar")');
      const result = await program.eval();
      expect(result).toBe("foobar");
    });

    test("should use string function with variables", async () => {
      const greet = celFunction("greet")
        .param("name", "string")
        .param("age", "double")
        .returns("string")
        .implement((name, age) => {
          return `Hello, ${name}! You are ${age} years old.`;
        });

      const env = await Env.new({
        variables: [
          { name: "name", type: "string" },
          { name: "age", type: "double" },
        ],
        functions: [greet],
      });
      const program = await env.compile("greet(name, age)");
      const result = await program.eval({ name: "Alice", age: 30 });
      expect(result).toBe("Hello, Alice! You are 30 years old.");
    });
  });

  describe("Boolean functions", () => {
    test("should define and use isEven function", async () => {
      const isEven = celFunction("isEven")
        .param("n", "int")
        .returns("bool")
        .implement((n) => Number(n) % 2 === 0);

      const env = await Env.new({
        functions: [isEven],
      });

      const program1 = await env.compile("isEven(42)");
      const result1 = await program1.eval();
      expect(result1).toBe(true);

      const program2 = await env.compile("isEven(43)");
      const result2 = await program2.eval();
      expect(result2).toBe(false);
    });

    test("should define and use comparison functions", async () => {
      const max = celFunction("max")
        .param("a", "int")
        .param("b", "int")
        .returns("int")
        .implement((a, b) => Math.max(Number(a), Number(b)));

      const min = celFunction("min")
        .param("a", "int")
        .param("b", "int")
        .returns("int")
        .implement((a, b) => Math.min(Number(a), Number(b)));

      const env = await Env.new({
        functions: [max, min],
      });

      const program1 = await env.compile("max(10, 20)");
      const result1 = await program1.eval();
      expect(result1).toBe(20);

      const program2 = await env.compile("min(10, 20)");
      const result2 = await program2.eval();
      expect(result2).toBe(10);
    });
  });

  describe("List functions", () => {
    test("should define and use sum function with list type", async () => {
      const sum = celFunction("sum")
        .param("numbers", listType("int"))
        .returns("int")
        .implement((numbers) => {
          if (!Array.isArray(numbers)) {
            return 0;
          }
          return numbers.reduce((acc, n) => acc + Number(n), 0);
        });

      const env = await Env.new({
        functions: [sum],
      });
      const program = await env.compile("sum([1, 2, 3, 4, 5])");
      const result = await program.eval();
      expect(result).toBe(15);
    });

    test("should define and use average function", async () => {
      const average = celFunction("average")
        .param("numbers", listType("double"))
        .returns("double")
        .implement((numbers) => {
          if (!Array.isArray(numbers) || numbers.length === 0) {
            return 0;
          }
          const sum = numbers.reduce((acc, n) => acc + Number(n), 0);
          return sum / numbers.length;
        });

      const env = await Env.new({
        functions: [average],
      });
      const program = await env.compile("average([10.0, 20.0, 30.0])");
      const result = await program.eval();
      expect(result).toBeCloseTo(20.0);
    });

    test("should define and use contains function", async () => {
      const contains = celFunction("contains")
        .param("list", listType("string"))
        .param("item", "string")
        .returns("bool")
        .implement((list, item) => {
          if (!Array.isArray(list)) {
            return false;
          }
          return list.includes(String(item));
        });

      const env = await Env.new({
        functions: [contains],
      });

      const program1 = await env.compile(
        'contains(["apple", "banana", "cherry"], "banana")',
      );
      const result1 = await program1.eval();
      expect(result1).toBe(true);

      const program2 = await env.compile(
        'contains(["apple", "banana", "cherry"], "grape")',
      );
      const result2 = await program2.eval();
      expect(result2).toBe(false);
    });
  });

  describe("Multiple functions", () => {
    test("should use multiple custom functions in one expression", async () => {
      const add = celFunction("add")
        .param("a", "double")
        .param("b", "double")
        .returns("double")
        .implement((a, b) => Number(a) + Number(b));

      const multiply = celFunction("multiply")
        .param("a", "double")
        .param("b", "double")
        .returns("double")
        .implement((a, b) => Number(a) * Number(b));

      const env = await Env.new({
        functions: [add, multiply],
      });
      const program = await env.compile(
        "multiply(add(2.0, 3.0), add(4.0, 1.0))",
      );
      const result = await program.eval();
      expect(result).toBe(25); // (2+3) * (4+1) = 5 * 5 = 25
    });

    test("should use nested function calls", async () => {
      const max = celFunction("max")
        .param("a", "double")
        .param("b", "double")
        .returns("double")
        .implement((a, b) => Math.max(Number(a), Number(b)));

      const min = celFunction("min")
        .param("a", "double")
        .param("b", "double")
        .returns("double")
        .implement((a, b) => Math.min(Number(a), Number(b)));

      const env = await Env.new({
        functions: [max, min],
      });
      const program = await env.compile("max(min(10.0, 5.0), 7.0)");
      const result = await program.eval();
      expect(result).toBe(7); // max(min(10, 5), 7) = max(5, 7) = 7
    });
  });

  describe("Complex function scenarios", () => {
    test("should combine custom functions with CEL built-ins", async () => {
      const square = celFunction("square")
        .param("n", "int")
        .returns("int")
        .implement((n) => Number(n) * Number(n));

      const env = await Env.new({
        functions: [square],
      });
      const program = await env.compile("square(5) + square(3)");
      const result = await program.eval();
      expect(result).toBe(34); // 25 + 9 = 34
    });

    test("should use custom functions with ternary expressions", async () => {
      const abs = celFunction("abs")
        .param("n", "double")
        .returns("double")
        .implement((n) => Math.abs(Number(n)));

      const env = await Env.new({
        variables: [{ name: "x", type: "double" }],
        functions: [abs],
      });
      const program = await env.compile('abs(x) > 0.0 ? "positive" : "zero"');
      const result = await program.eval({ x: -5.0 });
      expect(result).toBe("positive");
    });

    test("should use custom functions with list operations", async () => {
      const doubleValue = celFunction("doubleValue")
        .param("n", "int")
        .returns("int")
        .implement((n) => Number(n) * 2);

      const env = await Env.new({
        functions: [doubleValue],
      });
      const program = await env.compile("doubleValue(21)");
      const result = await program.eval();
      expect(result).toBe(42);
    });
  });

  describe("Function builder validation", () => {
    test("should throw error for invalid function name", () => {
      expect(() => {
        celFunction("123invalid");
      }).toThrow("Invalid function name");
    });

    test("should return function definition when implement is called", () => {
      const func = celFunction("test")
        .param("x", "int")
        .returns("int")
        .implement((x) => x * 2);
      // .implement() returns the final CELFunctionDefinition
      expect(func).toHaveProperty("name", "test");
      expect(func).toHaveProperty("params");
      expect(func).toHaveProperty("returnType", "int");
      expect(func).toHaveProperty("impl");
      expect(typeof func.impl).toBe("function");
    });

    test("should allow valid function names", () => {
      expect(() => {
        celFunction("valid_name")
          .param("x", "int")
          .returns("int")
          .implement(() => 0);
      }).not.toThrow();
    });
  });

  describe("Type helpers", () => {
    test("should use listType helper", async () => {
      const sum = celFunction("sum")
        .param("numbers", listType("int"))
        .returns("int")
        .implement((numbers) => {
          return Array.isArray(numbers)
            ? numbers.reduce((acc, n) => acc + Number(n), 0)
            : 0;
        });

      const env = await Env.new({
        functions: [sum],
      });
      const program = await env.compile("sum([1, 2, 3])");
      const result = await program.eval();
      expect(result).toBe(6);
    });

    test("should use nested list types", async () => {
      const flatten = celFunction("flatten")
        .param("lists", listType(listType("int")))
        .returns(listType("int"))
        .implement((lists) => {
          if (!Array.isArray(lists)) {
            return [];
          }
          return lists.flat();
        });

      const env = await Env.new({
        functions: [flatten],
      });
      const program = await env.compile("flatten([[1, 2], [3, 4]])");
      const result = await program.eval();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([1, 2, 3, 4]);
    });
  });

  describe("Error handling with custom functions", () => {
    test("should handle function implementation errors gracefully", async () => {
      const errorFunc = celFunction("errorFunc")
        .param("x", "int")
        .returns("int")
        .implement(() => {
          throw new Error("Test error");
        });

      const env = await Env.new({
        functions: [errorFunc],
      });
      const program = await env.compile("errorFunc(1)");
      await expect(program.eval()).rejects.toThrow();
    });

    test("should handle undefined function in expression", async () => {
      const env = await Env.new();
      await expect(env.compile("undefinedFunc(1)")).rejects.toThrow();
    });
  });
});
