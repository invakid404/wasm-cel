import { evaluateCEL, celFunction, listType } from "../dist/index.js";

describe("Custom Functions", () => {
  describe("Basic function definition and usage", () => {
    test("should define and use a simple addition function", async () => {
      const add = celFunction("add")
        .param("a", "int")
        .param("b", "int")
        .returns("int")
        .implement((a, b) => a + b);

      const result = await evaluateCEL("add(10, 20)", {
        functions: [add],
      });
      expect(result.result).toBe(30);
    });

    test("should define and use a multiplication function", async () => {
      const multiply = celFunction("multiply")
        .param("a", "int")
        .param("b", "int")
        .returns("int")
        .implement((a, b) => a * b);

      const result = await evaluateCEL("multiply(5, 7)", {
        functions: [multiply],
      });
      expect(result.result).toBe(35);
    });

    test("should use function with variables", async () => {
      const subtract = celFunction("subtract")
        .param("a", "double")
        .param("b", "double")
        .returns("double")
        .implement((a, b) => Number(a) - Number(b));

      const result = await evaluateCEL("subtract(x, y)", {
        vars: { x: 100, y: 30 },
        functions: [subtract],
      });
      expect(result.result).toBe(70);
    });
  });

  describe("String functions", () => {
    test("should define and use uppercase function", async () => {
      const uppercase = celFunction("uppercase")
        .param("str", "string")
        .returns("string")
        .implement((str) => String(str).toUpperCase());

      const result = await evaluateCEL('uppercase("hello world")', {
        functions: [uppercase],
      });
      expect(result.result).toBe("HELLO WORLD");
    });

    test("should define and use lowercase function", async () => {
      const lowercase = celFunction("lowercase")
        .param("str", "string")
        .returns("string")
        .implement((str) => String(str).toLowerCase());

      const result = await evaluateCEL('lowercase("HELLO WORLD")', {
        functions: [lowercase],
      });
      expect(result.result).toBe("hello world");
    });

    test("should define and use string concatenation function", async () => {
      const concat = celFunction("concat")
        .param("a", "string")
        .param("b", "string")
        .returns("string")
        .implement((a, b) => String(a) + String(b));

      const result = await evaluateCEL('concat("foo", "bar")', {
        functions: [concat],
      });
      expect(result.result).toBe("foobar");
    });

    test("should use string function with variables", async () => {
      const greet = celFunction("greet")
        .param("name", "string")
        .param("age", "double")
        .returns("string")
        .implement((name, age) => {
          return `Hello, ${name}! You are ${age} years old.`;
        });

      const result = await evaluateCEL("greet(name, age)", {
        vars: { name: "Alice", age: 30 },
        functions: [greet],
      });
      expect(result.result).toBe("Hello, Alice! You are 30 years old.");
    });
  });

  describe("Boolean functions", () => {
    test("should define and use isEven function", async () => {
      const isEven = celFunction("isEven")
        .param("n", "int")
        .returns("bool")
        .implement((n) => Number(n) % 2 === 0);

      const result1 = await evaluateCEL("isEven(42)", {
        functions: [isEven],
      });
      expect(result1.result).toBe(true);

      const result2 = await evaluateCEL("isEven(43)", {
        functions: [isEven],
      });
      expect(result2.result).toBe(false);
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

      const result1 = await evaluateCEL("max(10, 20)", {
        functions: [max],
      });
      expect(result1.result).toBe(20);

      const result2 = await evaluateCEL("min(10, 20)", {
        functions: [min],
      });
      expect(result2.result).toBe(10);
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

      const result = await evaluateCEL("sum([1, 2, 3, 4, 5])", {
        functions: [sum],
      });
      expect(result.result).toBe(15);
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

      const result = await evaluateCEL("average([10.0, 20.0, 30.0])", {
        functions: [average],
      });
      expect(result.result).toBeCloseTo(20.0);
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

      const result1 = await evaluateCEL(
        'contains(["apple", "banana", "cherry"], "banana")',
        {
          functions: [contains],
        },
      );
      expect(result1.result).toBe(true);

      const result2 = await evaluateCEL(
        'contains(["apple", "banana", "cherry"], "grape")',
        {
          functions: [contains],
        },
      );
      expect(result2.result).toBe(false);
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

      const result = await evaluateCEL(
        "multiply(add(2.0, 3.0), add(4.0, 1.0))",
        {
          functions: [add, multiply],
        },
      );
      expect(result.result).toBe(25); // (2+3) * (4+1) = 5 * 5 = 25
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

      const result = await evaluateCEL("max(min(10.0, 5.0), 7.0)", {
        functions: [max, min],
      });
      expect(result.result).toBe(7); // max(min(10, 5), 7) = max(5, 7) = 7
    });
  });

  describe("Complex function scenarios", () => {
    test("should combine custom functions with CEL built-ins", async () => {
      const square = celFunction("square")
        .param("n", "int")
        .returns("int")
        .implement((n) => Number(n) * Number(n));

      const result = await evaluateCEL("square(5) + square(3)", {
        functions: [square],
      });
      expect(result.result).toBe(34); // 25 + 9 = 34
    });

    test("should use custom functions with ternary expressions", async () => {
      const abs = celFunction("abs")
        .param("n", "double")
        .returns("double")
        .implement((n) => Math.abs(Number(n)));

      const result = await evaluateCEL('abs(x) > 0.0 ? "positive" : "zero"', {
        vars: { x: -5.0 },
        functions: [abs],
      });
      expect(result.result).toBe("positive");
    });

    test("should use custom functions with list operations", async () => {
      const doubleValue = celFunction("doubleValue")
        .param("n", "int")
        .returns("int")
        .implement((n) => Number(n) * 2);

      // Note: This would require list mapping which CEL supports
      // For now, we test with a single value
      const result = await evaluateCEL("doubleValue(21)", {
        functions: [doubleValue],
      });
      expect(result.result).toBe(42);
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

      const result = await evaluateCEL("sum([1, 2, 3])", {
        functions: [sum],
      });
      expect(result.result).toBe(6);
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

      const result = await evaluateCEL("flatten([[1, 2], [3, 4]])", {
        functions: [flatten],
      });
      expect(Array.isArray(result.result)).toBe(true);
      expect(result.result).toEqual([1, 2, 3, 4]);
    });
  });

  describe("Backward compatibility", () => {
    test("should work without custom functions (backward compatible)", async () => {
      const result = await evaluateCEL("10 + 20");
      expect(result.result).toBe(30);
    });

    test("should work with variables only (backward compatible)", async () => {
      const result = await evaluateCEL("x + y", { x: 10, y: 20 });
      expect(result.result).toBe(30);
    });

    test("should work with old API style (variables as second arg)", async () => {
      const result = await evaluateCEL("x + y", { x: 5, y: 15 });
      expect(result.result).toBe(20);
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

      await expect(
        evaluateCEL("errorFunc(1)", {
          functions: [errorFunc],
        }),
      ).rejects.toThrow();
    });

    test("should handle undefined function in expression", async () => {
      await expect(evaluateCEL("undefinedFunc(1)")).rejects.toThrow();
    });
  });
});
