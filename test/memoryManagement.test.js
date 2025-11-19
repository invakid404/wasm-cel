import { Env, CELFunction } from "../dist/index.js";

describe("Memory Management", () => {
  describe("Environment and Program lifecycle", () => {
    test("programs should continue to work after environment is destroyed", async () => {
      const add = CELFunction.new("add")
        .param("a", "int")
        .param("b", "int")
        .returns("int")
        .implement((a, b) => a + b);

      const env = await Env.new({
        functions: [add],
      });

      const program = await env.compile("add(10, 20)");

      // Destroy the environment
      env.destroy();

      // Program should still work because functions are reference counted
      const result = await program.eval();
      expect(result).toBe(30);

      // Clean up program
      program.destroy();
    });

    test("should not allow creating new programs from destroyed environment", async () => {
      const env = await Env.new();
      env.destroy();

      await expect(env.compile("10 + 20")).rejects.toThrow(
        "Environment has been destroyed",
      );
    });

    test("should not allow typechecking from destroyed environment", async () => {
      const env = await Env.new();
      env.destroy();

      await expect(env.typecheck("10 + 20")).rejects.toThrow(
        "Environment has been destroyed",
      );
    });

    test("functions should be cleaned up when all programs are destroyed", async () => {
      const add = CELFunction.new("add")
        .param("a", "int")
        .param("b", "int")
        .returns("int")
        .implement((a, b) => a + b);

      const env = await Env.new({
        functions: [add],
      });

      const program1 = await env.compile("add(5, 10)");
      const program2 = await env.compile("add(20, 30)");

      // Destroy environment - functions should still be available
      env.destroy();

      // Both programs should still work
      expect(await program1.eval()).toBe(15);
      expect(await program2.eval()).toBe(50);

      // Destroy first program - functions should still be available
      program1.destroy();
      expect(await program2.eval()).toBe(50);

      // Destroy second program - now functions should be cleaned up
      program2.destroy();
    });

    test("should handle multiple environments with same function names", async () => {
      const add1 = CELFunction.new("add")
        .param("a", "int")
        .param("b", "int")
        .returns("int")
        .implement((a, b) => a + b);

      const add2 = CELFunction.new("add")
        .param("a", "int")
        .param("b", "int")
        .returns("int")
        .implement((a, b) => a + b + 1); // Different implementation

      const env1 = await Env.new({ functions: [add1] });
      const env2 = await Env.new({ functions: [add2] });

      const program1 = await env1.compile("add(10, 20)");
      const program2 = await env2.compile("add(10, 20)");

      // Destroy both environments
      env1.destroy();
      env2.destroy();

      // Programs should still work with their respective function implementations
      expect(await program1.eval()).toBe(30);
      expect(await program2.eval()).toBe(31);

      program1.destroy();
      program2.destroy();
    });

    test("destroy should be idempotent", async () => {
      const env = await Env.new();
      const program = await env.compile("10 + 20");

      // Destroy multiple times should not error
      env.destroy();
      env.destroy();

      program.destroy();
      program.destroy();
    });

    test("should throw error when using destroyed program", async () => {
      const env = await Env.new();
      const program = await env.compile("10 + 20");

      program.destroy();

      await expect(program.eval()).rejects.toThrow(
        "Program has been destroyed",
      );
    });

    test("should immediately clean up environment with no programs", async () => {
      const add = CELFunction.new("add")
        .param("a", "int")
        .param("b", "int")
        .returns("int")
        .implement((a, b) => a + b);

      const env = await Env.new({
        functions: [add],
      });

      // Destroy environment without creating any programs
      // This should immediately clean up functions since ref counts are 0
      env.destroy();

      // Environment should be cleaned up immediately
      // (We can't directly verify this, but we can verify that creating
      // a new environment with the same function name works, which means
      // the old one was cleaned up)
      const env2 = await Env.new({
        functions: [add],
      });
      const program = await env2.compile("add(5, 10)");
      expect(await program.eval()).toBe(15);

      program.destroy();
      env2.destroy();
    });

    test("should clean up environment when last program is destroyed", async () => {
      const env = await Env.new();
      const program = await env.compile("10 + 20");

      // Destroy environment first
      env.destroy();

      // Destroy the last program - this should clean up the environment
      program.destroy();

      // Environment should be cleaned up
      // (We verify this indirectly by ensuring no errors occur)
    });
  });
});
