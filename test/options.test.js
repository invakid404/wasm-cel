import { Env, Options } from "../dist/index.js";

describe("CEL Environment Options", () => {
  describe("Simple options", () => {
    test("should create environment with OptionalTypes option during construction", async () => {
      const env = await Env.new({
        variables: [
          { name: 'data', type: { kind: 'map', keyType: 'string', valueType: 'string' } }
        ],
        options: [Options.optionalTypes()]
      });

      const program = await env.compile('data.?hello.orValue("world")');
      const result = await program.eval({ data: {} });
      expect(result).toBe("world");

      program.destroy();
      env.destroy();
    });

    test("should handle optional field access with missing and present keys", async () => {
      const env = await Env.new({
        variables: [
          { name: 'data', type: { kind: 'map', keyType: 'string', valueType: 'string' } }
        ],
        options: [Options.optionalTypes()]
      });

      const program = await env.compile('data.?key.orValue("default")');
      
      // Test with key present
      const resultWithKey = await program.eval({ data: { key: 'hello world' } });
      expect(resultWithKey).toBe("hello world");
      
      // Test with key missing
      const resultWithoutKey = await program.eval({ data: { otherKey: 'other value' } });
      expect(resultWithoutKey).toBe("default");

      program.destroy();
      env.destroy();
    });

    test("should support optional.of() and optional.none() functions", async () => {
      const env = await Env.new({
        options: [Options.optionalTypes()]
      });

      // Test optional.of()
      const program1 = await env.compile('optional.of("test").hasValue()');
      const result1 = await program1.eval({});
      expect(result1).toBe(true);

      // Test optional.none()
      const program2 = await env.compile('optional.none().hasValue()');
      const result2 = await program2.eval({});
      expect(result2).toBe(false);

      program1.destroy();
      program2.destroy();
      env.destroy();
    });

    test("should extend environment with OptionalTypes option after creation", async () => {
      const env = await Env.new({
        variables: [
          { name: 'data', type: { kind: 'map', keyType: 'string', valueType: 'string' } }
        ]
      });

      await env.extend([Options.optionalTypes()]);

      const program = await env.compile('data.?greeting.orValue("hello")');
      const result = await program.eval({ data: {} });
      expect(result).toBe("hello");

      program.destroy();
      env.destroy();
    });

    test("should produce same results for options during creation vs extend", async () => {
      const env1 = await Env.new({
        variables: [
          { name: 'data', type: { kind: 'map', keyType: 'string', valueType: 'string' } }
        ],
        options: [Options.optionalTypes()]
      });

      const env2 = await Env.new({
        variables: [
          { name: 'data', type: { kind: 'map', keyType: 'string', valueType: 'string' } }
        ]
      });
      await env2.extend([Options.optionalTypes()]);

      const program1 = await env1.compile('data.?missing.orValue("default")');
      const program2 = await env2.compile('data.?missing.orValue("default")');
      
      const result1 = await program1.eval({ data: {} });
      const result2 = await program2.eval({ data: {} });
      
      expect(result1).toBe("default");
      expect(result2).toBe("default");
      expect(result1).toBe(result2);

      program1.destroy();
      program2.destroy();
      env1.destroy();
      env2.destroy();
    });
  });

  describe("Error handling", () => {
    test("should handle empty options array", async () => {
      const env = await Env.new({
        options: []
      });

      const program = await env.compile('5 + 1');
      const result = await program.eval();
      expect(result).toBe(6);

      program.destroy();
      env.destroy();
    });

    test("should handle extend with empty options", async () => {
      const env = await Env.new();

      await env.extend([]);

      const program = await env.compile('3 * 2');
      const result = await program.eval();
      expect(result).toBe(6);

      program.destroy();
      env.destroy();
    });

    test("should reject extending destroyed environment", async () => {
      const env = await Env.new({
        variables: [{ name: 'x', type: 'int' }]
      });

      env.destroy();

      await expect(env.extend([Options.optionalTypes()])).rejects.toThrow("Environment has been destroyed");
    });
  });
});