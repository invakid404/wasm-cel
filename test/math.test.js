import { Env, Options } from "../dist/index.js";

describe("CEL Math Extension", () => {
  let env;

  beforeAll(async () => {
    env = await Env.new({
      variables: [
        { name: "x", type: "double" },
        { name: "n", type: "int" },
      ],
      options: [Options.math()],
    });
  });

  afterAll(() => {
    env.destroy();
  });

  describe("math.greatest", () => {
    test("should return greatest of multiple integers", async () => {
      const program = await env.compile("math.greatest(1, 2, 3)");
      const result = await program.eval();
      expect(result).toBe(3);
      program.destroy();
    });

    test("should return greatest of multiple doubles", async () => {
      const program = await env.compile(
        "math.greatest(-42.0, -21.5, -100.0)",
      );
      const result = await program.eval();
      expect(result).toBe(-21.5);
      program.destroy();
    });

    test("should handle single argument", async () => {
      const program = await env.compile("math.greatest(42)");
      const result = await program.eval();
      expect(result).toBe(42);
      program.destroy();
    });

    test("should work with a list argument", async () => {
      const program = await env.compile("math.greatest([3, 1, 2])");
      const result = await program.eval();
      expect(result).toBe(3);
      program.destroy();
    });
  });

  describe("math.least", () => {
    test("should return least of multiple integers", async () => {
      const program = await env.compile("math.least(1, 2, 3)");
      const result = await program.eval();
      expect(result).toBe(1);
      program.destroy();
    });

    test("should return least of multiple doubles", async () => {
      const program = await env.compile("math.least(-42.0, -21.5, -100.0)");
      const result = await program.eval();
      expect(result).toBe(-100.0);
      program.destroy();
    });

    test("should work with a list argument", async () => {
      const program = await env.compile("math.least([3, 1, 2])");
      const result = await program.eval();
      expect(result).toBe(1);
      program.destroy();
    });
  });

  describe("math.ceil", () => {
    test("should ceil a positive double", async () => {
      const program = await env.compile("math.ceil(1.2)");
      const result = await program.eval();
      expect(result).toBe(2.0);
      program.destroy();
    });

    test("should ceil a negative double", async () => {
      const program = await env.compile("math.ceil(-1.2)");
      const result = await program.eval();
      expect(result).toBe(-1.0);
      program.destroy();
    });

    test("should work with variables", async () => {
      const program = await env.compile("math.ceil(x)");
      const result = await program.eval({ x: 3.7, n: 0 });
      expect(result).toBe(4.0);
      program.destroy();
    });
  });

  describe("math.floor", () => {
    test("should floor a positive double", async () => {
      const program = await env.compile("math.floor(1.2)");
      const result = await program.eval();
      expect(result).toBe(1.0);
      program.destroy();
    });

    test("should floor a negative double", async () => {
      const program = await env.compile("math.floor(-1.2)");
      const result = await program.eval();
      expect(result).toBe(-2.0);
      program.destroy();
    });
  });

  describe("math.round", () => {
    test("should round down", async () => {
      const program = await env.compile("math.round(1.2)");
      const result = await program.eval();
      expect(result).toBe(1.0);
      program.destroy();
    });

    test("should round up at 0.5", async () => {
      const program = await env.compile("math.round(1.5)");
      const result = await program.eval();
      expect(result).toBe(2.0);
      program.destroy();
    });

    test("should round negative away from zero at 0.5", async () => {
      const program = await env.compile("math.round(-1.5)");
      const result = await program.eval();
      expect(result).toBe(-2.0);
      program.destroy();
    });
  });

  describe("math.trunc", () => {
    test("should truncate positive double", async () => {
      const program = await env.compile("math.trunc(1.9)");
      const result = await program.eval();
      expect(result).toBe(1.0);
      program.destroy();
    });

    test("should truncate negative double", async () => {
      const program = await env.compile("math.trunc(-1.9)");
      const result = await program.eval();
      expect(result).toBe(-1.0);
      program.destroy();
    });
  });

  describe("math.abs", () => {
    test("should return absolute value of negative int", async () => {
      const program = await env.compile("math.abs(-42)");
      const result = await program.eval();
      expect(result).toBe(42);
      program.destroy();
    });

    test("should return same value for positive int", async () => {
      const program = await env.compile("math.abs(42)");
      const result = await program.eval();
      expect(result).toBe(42);
      program.destroy();
    });

    test("should work with doubles", async () => {
      const program = await env.compile("math.abs(-3.14)");
      const result = await program.eval();
      expect(result).toBeCloseTo(3.14);
      program.destroy();
    });
  });

  describe("math.sign", () => {
    test("should return -1 for negative", async () => {
      const program = await env.compile("math.sign(-42)");
      const result = await program.eval();
      expect(result).toBe(-1);
      program.destroy();
    });

    test("should return 0 for zero", async () => {
      const program = await env.compile("math.sign(0)");
      const result = await program.eval();
      expect(result).toBe(0);
      program.destroy();
    });

    test("should return 1 for positive", async () => {
      const program = await env.compile("math.sign(42)");
      const result = await program.eval();
      expect(result).toBe(1);
      program.destroy();
    });
  });

  describe("math.isInf", () => {
    test("should return true for infinity", async () => {
      const program = await env.compile("math.isInf(1.0 / 0.0)");
      const result = await program.eval();
      expect(result).toBe(true);
      program.destroy();
    });

    test("should return false for finite number", async () => {
      const program = await env.compile("math.isInf(1.2)");
      const result = await program.eval();
      expect(result).toBe(false);
      program.destroy();
    });
  });

  describe("math.isNaN", () => {
    test("should return true for NaN", async () => {
      const program = await env.compile("math.isNaN(0.0 / 0.0)");
      const result = await program.eval();
      expect(result).toBe(true);
      program.destroy();
    });

    test("should return false for a number", async () => {
      const program = await env.compile("math.isNaN(1.2)");
      const result = await program.eval();
      expect(result).toBe(false);
      program.destroy();
    });
  });

  describe("math.isFinite", () => {
    test("should return true for finite number", async () => {
      const program = await env.compile("math.isFinite(1.2)");
      const result = await program.eval();
      expect(result).toBe(true);
      program.destroy();
    });

    test("should return false for infinity", async () => {
      const program = await env.compile("math.isFinite(1.0 / 0.0)");
      const result = await program.eval();
      expect(result).toBe(false);
      program.destroy();
    });

    test("should return false for NaN", async () => {
      const program = await env.compile("math.isFinite(0.0 / 0.0)");
      const result = await program.eval();
      expect(result).toBe(false);
      program.destroy();
    });
  });

  describe("bitwise operations", () => {
    test("math.bitOr should OR two integers", async () => {
      const program = await env.compile("math.bitOr(1, 2)");
      const result = await program.eval();
      expect(result).toBe(3);
      program.destroy();
    });

    test("math.bitAnd should AND two integers", async () => {
      const program = await env.compile("math.bitAnd(3, 5)");
      const result = await program.eval();
      expect(result).toBe(1);
      program.destroy();
    });

    test("math.bitXor should XOR two integers", async () => {
      const program = await env.compile("math.bitXor(1, 3)");
      const result = await program.eval();
      expect(result).toBe(2);
      program.destroy();
    });

    test("math.bitNot should NOT an integer", async () => {
      const program = await env.compile("math.bitNot(1)");
      const result = await program.eval();
      expect(result).toBe(-2);
      program.destroy();
    });

    test("math.bitShiftLeft should shift left", async () => {
      const program = await env.compile("math.bitShiftLeft(1, 2)");
      const result = await program.eval();
      expect(result).toBe(4);
      program.destroy();
    });

    test("math.bitShiftRight should shift right", async () => {
      const program = await env.compile("math.bitShiftRight(1024, 2)");
      const result = await program.eval();
      expect(result).toBe(256);
      program.destroy();
    });
  });

  describe("environment setup", () => {
    test("should work when added via extend", async () => {
      const extEnv = await Env.new({
        variables: [{ name: "x", type: "double" }],
      });

      await expect(extEnv.compile("math.ceil(x)")).rejects.toThrow();

      await extEnv.extend([Options.math()]);

      const program = await extEnv.compile("math.ceil(x)");
      const result = await program.eval({ x: 1.2 });
      expect(result).toBe(2.0);

      program.destroy();
      extEnv.destroy();
    });

    test("should support version configuration", async () => {
      const v0Env = await Env.new({
        options: [Options.math({ version: 0 })],
      });

      // Version 0 should have greatest/least
      const program = await v0Env.compile("math.greatest(1, 2, 3)");
      const result = await program.eval();
      expect(result).toBe(3);

      program.destroy();
      v0Env.destroy();
    });
  });
});
