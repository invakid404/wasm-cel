import { Env, Options } from "../dist/index.js";

describe("CEL Encoders Extension", () => {
  let env;

  beforeAll(async () => {
    env = await Env.new({
      variables: [{ name: "s", type: "string" }],
      options: [Options.encoders()],
    });
  });

  afterAll(() => {
    env.destroy();
  });

  describe("base64.encode", () => {
    test("should encode bytes to base64 string", async () => {
      const program = await env.compile("base64.encode(b'hello')");
      const result = await program.eval();
      expect(result).toBe("aGVsbG8=");
      program.destroy();
    });

    test("should encode empty bytes", async () => {
      const program = await env.compile("base64.encode(b'')");
      const result = await program.eval();
      expect(result).toBe("");
      program.destroy();
    });

  });

  describe("base64.decode", () => {
    test("should decode base64 string to bytes (returned as base64)", async () => {
      // base64.decode returns bytes; ValueToJSON base64-encodes bytes for JS
      const program = await env.compile("base64.decode('aGVsbG8=')");
      const result = await program.eval();
      expect(result).toBe("aGVsbG8=");
      program.destroy();
    });

    test("should decode base64 without padding", async () => {
      const program = await env.compile("base64.decode('aGVsbG8')");
      const result = await program.eval();
      expect(result).toBe("aGVsbG8=");
      program.destroy();
    });

    test("should handle empty base64 string", async () => {
      const program = await env.compile("base64.decode('')");
      const result = await program.eval();
      expect(result).toBe("");
      program.destroy();
    });

    test("should decode variable string", async () => {
      const program = await env.compile("base64.decode(s)");
      const result = await program.eval({ s: "d29ybGQ=" });
      expect(result).toBe("d29ybGQ=");
      program.destroy();
    });
  });

  describe("roundtrip", () => {
    test("encode then decode should preserve bytes", async () => {
      const program = await env.compile(
        "base64.encode(base64.decode('aGVsbG8='))",
      );
      const result = await program.eval();
      expect(result).toBe("aGVsbG8=");
      program.destroy();
    });

    test("should verify decoded byte length via size", async () => {
      const program = await env.compile("size(base64.decode('aGVsbG8='))");
      const result = await program.eval();
      expect(result).toBe(5); // "hello" is 5 bytes
      program.destroy();
    });
  });

  describe("environment setup", () => {
    test("should work when added via extend", async () => {
      const extEnv = await Env.new({
        variables: [{ name: "s", type: "string" }],
      });

      await expect(extEnv.compile("base64.decode(s)")).rejects.toThrow();

      await extEnv.extend([Options.encoders()]);

      const program = await extEnv.compile("base64.decode(s)");
      const result = await program.eval({ s: "aGVsbG8=" });
      expect(result).toBe("aGVsbG8=");

      program.destroy();
      extEnv.destroy();
    });

    test("should work combined with other extensions", async () => {
      const combinedEnv = await Env.new({
        options: [Options.strings(), Options.encoders()],
      });

      // Use strings extension to manipulate, then encode
      const program = await combinedEnv.compile(
        "base64.encode(b'hello') + ' ' + 'world'.upperAscii()",
      );
      const result = await program.eval();
      expect(result).toBe("aGVsbG8= WORLD");

      program.destroy();
      combinedEnv.destroy();
    });
  });
});
