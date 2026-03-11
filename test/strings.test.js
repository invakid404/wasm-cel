import { Env, Options } from "../dist/index.js";

describe("CEL String Extension", () => {
  let env;

  beforeAll(async () => {
    env = await Env.new({
      variables: [
        { name: "s", type: "string" },
        { name: "items", type: { kind: "list", elemType: "string" } },
      ],
      options: [Options.strings()],
    });
  });

  afterAll(() => {
    env.destroy();
  });

  describe("charAt", () => {
    test("should return character at given position", async () => {
      const program = await env.compile("'hello'.charAt(4)");
      const result = await program.eval();
      expect(result).toBe("o");
      program.destroy();
    });

    test("should return empty string at end of string", async () => {
      const program = await env.compile("'hello'.charAt(5)");
      const result = await program.eval();
      expect(result).toBe("");
      program.destroy();
    });

    test("should work with variables", async () => {
      const program = await env.compile("s.charAt(0)");
      const result = await program.eval({ s: "world", items: [] });
      expect(result).toBe("w");
      program.destroy();
    });
  });

  describe("indexOf", () => {
    test("should return index of first occurrence", async () => {
      const program = await env.compile("'hello mellow'.indexOf('ello')");
      const result = await program.eval();
      expect(result).toBe(1);
      program.destroy();
    });

    test("should return -1 when not found", async () => {
      const program = await env.compile("'hello mellow'.indexOf('jello')");
      const result = await program.eval();
      expect(result).toBe(-1);
      program.destroy();
    });

    test("should support offset parameter", async () => {
      const program = await env.compile("'hello mellow'.indexOf('ello', 2)");
      const result = await program.eval();
      expect(result).toBe(7);
      program.destroy();
    });

    test("should return 0 for empty search string", async () => {
      const program = await env.compile("'hello mellow'.indexOf('')");
      const result = await program.eval();
      expect(result).toBe(0);
      program.destroy();
    });
  });

  describe("lastIndexOf", () => {
    test("should return index of last occurrence", async () => {
      const program = await env.compile("'hello mellow'.lastIndexOf('ello')");
      const result = await program.eval();
      expect(result).toBe(7);
      program.destroy();
    });

    test("should return -1 when not found", async () => {
      const program = await env.compile("'hello mellow'.lastIndexOf('jello')");
      const result = await program.eval();
      expect(result).toBe(-1);
      program.destroy();
    });

    test("should support offset parameter", async () => {
      const program = await env.compile(
        "'hello mellow'.lastIndexOf('ello', 6)",
      );
      const result = await program.eval();
      expect(result).toBe(1);
      program.destroy();
    });
  });

  describe("join", () => {
    test("should join list elements with no separator", async () => {
      const program = await env.compile("items.join()");
      const result = await program.eval({
        s: "",
        items: ["hello", "mellow"],
      });
      expect(result).toBe("hellomellow");
      program.destroy();
    });

    test("should join list elements with separator", async () => {
      const program = await env.compile("items.join(' ')");
      const result = await program.eval({
        s: "",
        items: ["hello", "mellow"],
      });
      expect(result).toBe("hello mellow");
      program.destroy();
    });

    test("should return empty string for empty list", async () => {
      const program = await env.compile("items.join('/')");
      const result = await program.eval({ s: "", items: [] });
      expect(result).toBe("");
      program.destroy();
    });
  });

  describe("lowerAscii", () => {
    test("should lowercase ASCII characters", async () => {
      const program = await env.compile("'TacoCat'.lowerAscii()");
      const result = await program.eval();
      expect(result).toBe("tacocat");
      program.destroy();
    });

    test("should not affect non-ASCII characters", async () => {
      const program = await env.compile("s.lowerAscii()");
      const result = await program.eval({ s: "TacoCÆt Xii", items: [] });
      expect(result).toBe("tacocÆt xii");
      program.destroy();
    });
  });

  describe("upperAscii", () => {
    test("should uppercase ASCII characters", async () => {
      const program = await env.compile("'TacoCat'.upperAscii()");
      const result = await program.eval();
      expect(result).toBe("TACOCAT");
      program.destroy();
    });

    test("should not affect non-ASCII characters", async () => {
      const program = await env.compile("s.upperAscii()");
      const result = await program.eval({ s: "TacoCÆt Xii", items: [] });
      expect(result).toBe("TACOCÆT XII");
      program.destroy();
    });
  });

  describe("replace", () => {
    test("should replace all occurrences", async () => {
      const program = await env.compile("'hello hello'.replace('he', 'we')");
      const result = await program.eval();
      expect(result).toBe("wello wello");
      program.destroy();
    });

    test("should support replacement limit", async () => {
      const program = await env.compile(
        "'hello hello'.replace('he', 'we', 1)",
      );
      const result = await program.eval();
      expect(result).toBe("wello hello");
      program.destroy();
    });

    test("should return original when limit is 0", async () => {
      const program = await env.compile(
        "'hello hello'.replace('he', 'we', 0)",
      );
      const result = await program.eval();
      expect(result).toBe("hello hello");
      program.destroy();
    });

    test("should handle empty search string", async () => {
      const program = await env.compile("'hello'.replace('', '_')");
      const result = await program.eval();
      expect(result).toBe("_h_e_l_l_o_");
      program.destroy();
    });
  });

  describe("split", () => {
    test("should split string by separator", async () => {
      const program = await env.compile("'hello hello hello'.split(' ')");
      const result = await program.eval();
      expect(result).toEqual(["hello", "hello", "hello"]);
      program.destroy();
    });

    test("should support split limit", async () => {
      const program = await env.compile("'hello hello hello'.split(' ', 2)");
      const result = await program.eval();
      expect(result).toEqual(["hello", "hello hello"]);
      program.destroy();
    });

    test("should return empty list when limit is 0", async () => {
      const program = await env.compile("'hello hello hello'.split(' ', 0)");
      const result = await program.eval();
      expect(result).toEqual([]);
      program.destroy();
    });

    test("should return full string when limit is 1", async () => {
      const program = await env.compile("'hello hello hello'.split(' ', 1)");
      const result = await program.eval();
      expect(result).toEqual(["hello hello hello"]);
      program.destroy();
    });
  });

  describe("substring", () => {
    test("should return substring from index to end", async () => {
      const program = await env.compile("'tacocat'.substring(4)");
      const result = await program.eval();
      expect(result).toBe("cat");
      program.destroy();
    });

    test("should return substring with start and end", async () => {
      const program = await env.compile("'tacocat'.substring(0, 4)");
      const result = await program.eval();
      expect(result).toBe("taco");
      program.destroy();
    });
  });

  describe("trim", () => {
    test("should trim leading and trailing whitespace", async () => {
      const program = await env.compile("'  \\ttrim\\n    '.trim()");
      const result = await program.eval();
      expect(result).toBe("trim");
      program.destroy();
    });

    test("should return same string when no whitespace", async () => {
      const program = await env.compile("'hello'.trim()");
      const result = await program.eval();
      expect(result).toBe("hello");
      program.destroy();
    });
  });

  describe("environment setup", () => {
    test("should work when added via extend", async () => {
      const extEnv = await Env.new({
        variables: [{ name: "s", type: "string" }],
      });

      // Before extending, string extension functions should fail
      await expect(extEnv.compile("s.lowerAscii()")).rejects.toThrow();

      await extEnv.extend([Options.strings()]);

      // After extending, they should work
      const program = await extEnv.compile("s.lowerAscii()");
      const result = await program.eval({ s: "HELLO" });
      expect(result).toBe("hello");

      program.destroy();
      extEnv.destroy();
    });

    test("should work with other options combined", async () => {
      const combinedEnv = await Env.new({
        variables: [
          {
            name: "data",
            type: { kind: "map", keyType: "string", valueType: "string" },
          },
        ],
        options: [Options.optionalTypes(), Options.strings()],
      });

      // Test optional types and string extension together
      const program = await combinedEnv.compile(
        "data.?name.orValue('unknown').upperAscii()",
      );
      const result = await program.eval({ data: {} });
      expect(result).toBe("UNKNOWN");

      program.destroy();
      combinedEnv.destroy();
    });

    test("should support version configuration", async () => {
      // Version 0 should have basic functions
      const v0Env = await Env.new({
        options: [Options.strings({ version: 0 })],
      });

      const program = await v0Env.compile("'hello'.upperAscii()");
      const result = await program.eval();
      expect(result).toBe("HELLO");

      program.destroy();
      v0Env.destroy();
    });
  });
});
