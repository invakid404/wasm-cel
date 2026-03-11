import { Env, Options } from "../dist/index.js";

describe("CEL Encoders Extension", () => {
  let env;

  beforeAll(async () => {
    env = await Env.new({
      variables: [
        { name: "s", type: "string" },
        { name: "data", type: "bytes" },
      ],
      options: [Options.encoders()],
    });
  });

  afterAll(() => {
    env.destroy();
  });

  describe("base64.encode", () => {
    test("should encode byte literal to base64 string", async () => {
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

    test("should encode bytes variable passed as Uint8Array", async () => {
      const program = await env.compile("base64.encode(data)");
      const hello = new TextEncoder().encode("test");
      const result = await program.eval({ s: "", data: hello });
      expect(result).toBe("dGVzdA==");
      program.destroy();
    });
  });

  describe("base64.decode", () => {
    test("should decode base64 string to Uint8Array", async () => {
      const program = await env.compile("base64.decode('aGVsbG8=')");
      const result = await program.eval();
      expect(result).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(result)).toBe("hello");
      program.destroy();
    });

    test("should decode base64 without padding", async () => {
      const program = await env.compile("base64.decode('aGVsbG8')");
      const result = await program.eval();
      expect(result).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(result)).toBe("hello");
      program.destroy();
    });

    test("should handle empty base64 string", async () => {
      const program = await env.compile("base64.decode('')");
      const result = await program.eval();
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(0);
      program.destroy();
    });

    test("should decode variable string", async () => {
      const program = await env.compile("base64.decode(s)");
      const result = await program.eval({ s: "d29ybGQ=", data: new Uint8Array() });
      expect(result).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(result)).toBe("world");
      program.destroy();
    });
  });

  describe("roundtrip", () => {
    test("encode(decode(x)) should return original base64", async () => {
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

    test("decode(encode(x)) should return original bytes", async () => {
      const program = await env.compile("base64.decode(base64.encode(data))");
      const input = new TextEncoder().encode("roundtrip");
      const result = await program.eval({ s: "", data: input });
      expect(result).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(result)).toBe("roundtrip");
      program.destroy();
    });
  });

  describe("bytes variable interop", () => {
    test("should pass Uint8Array and get it back", async () => {
      // Identity: just return the bytes variable
      const program = await env.compile("data");
      const input = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await program.eval({ s: "", data: input });
      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result)).toEqual([1, 2, 3, 4, 5]);
      program.destroy();
    });

    test("should support size() on bytes variable", async () => {
      const program = await env.compile("size(data)");
      const input = new Uint8Array([10, 20, 30]);
      const result = await program.eval({ s: "", data: input });
      expect(result).toBe(3);
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
      expect(result).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(result)).toBe("hello");

      program.destroy();
      extEnv.destroy();
    });

    test("should work combined with other extensions", async () => {
      const combinedEnv = await Env.new({
        options: [Options.strings(), Options.encoders()],
      });

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
