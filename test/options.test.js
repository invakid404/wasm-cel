import { Env, Options } from "../dist/index.js";

describe("CEL Environment Options", () => {
  describe("Simple options", () => {
    test("should create environment with OptionalTypes option during construction", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "data",
            type: { kind: "map", keyType: "string", valueType: "string" },
          },
        ],
        options: [Options.optionalTypes()],
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
          {
            name: "data",
            type: { kind: "map", keyType: "string", valueType: "string" },
          },
        ],
        options: [Options.optionalTypes()],
      });

      const program = await env.compile('data.?key.orValue("default")');

      // Test with key present
      const resultWithKey = await program.eval({
        data: { key: "hello world" },
      });
      expect(resultWithKey).toBe("hello world");

      // Test with key missing
      const resultWithoutKey = await program.eval({
        data: { otherKey: "other value" },
      });
      expect(resultWithoutKey).toBe("default");

      program.destroy();
      env.destroy();
    });

    test("should support optional.of() and optional.none() functions", async () => {
      const env = await Env.new({
        options: [Options.optionalTypes()],
      });

      // Test optional.of()
      const program1 = await env.compile('optional.of("test").hasValue()');
      const result1 = await program1.eval({});
      expect(result1).toBe(true);

      // Test optional.none()
      const program2 = await env.compile("optional.none().hasValue()");
      const result2 = await program2.eval({});
      expect(result2).toBe(false);

      program1.destroy();
      program2.destroy();
      env.destroy();
    });

    test("should extend environment with OptionalTypes option after creation", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "data",
            type: { kind: "map", keyType: "string", valueType: "string" },
          },
        ],
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
          {
            name: "data",
            type: { kind: "map", keyType: "string", valueType: "string" },
          },
        ],
        options: [Options.optionalTypes()],
      });

      const env2 = await Env.new({
        variables: [
          {
            name: "data",
            type: { kind: "map", keyType: "string", valueType: "string" },
          },
        ],
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
        options: [],
      });

      const program = await env.compile("5 + 1");
      const result = await program.eval();
      expect(result).toBe(6);

      program.destroy();
      env.destroy();
    });

    test("should handle extend with empty options", async () => {
      const env = await Env.new();

      await env.extend([]);

      const program = await env.compile("3 * 2");
      const result = await program.eval();
      expect(result).toBe(6);

      program.destroy();
      env.destroy();
    });

    test("should reject extending destroyed environment", async () => {
      const env = await Env.new({
        variables: [{ name: "x", type: "int" }],
      });

      env.destroy();

      await expect(env.extend([Options.optionalTypes()])).rejects.toThrow(
        "Environment has been destroyed",
      );
    });
  });

  describe("ASTValidators option", () => {
    test("should create environment with ASTValidators during construction", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "user",
            type: { kind: "map", keyType: "string", valueType: "string" },
          },
        ],
        options: [
          Options.astValidators({
            validators: [
              // Simple validator that warns about accessing password field
              (nodeType, nodeData, context) => {
                if (nodeType === "select" && nodeData.field === "password") {
                  return {
                    issues: [
                      {
                        severity: "warning",
                        message: "Accessing password field may not be secure",
                      },
                    ],
                  };
                }
                return { issues: [] };
              },
            ],
            options: {
              failOnWarning: false, // Don't fail compilation on warnings
              includeWarnings: true,
            },
          }),
        ],
      });

      // Test with compileDetailed to verify warnings are exposed
      const compilationResult = await env.compileDetailed("user.password");

      // Compilation should succeed
      expect(compilationResult.success).toBe(true);
      expect(compilationResult.program).toBeDefined();
      expect(compilationResult.error).toBeUndefined();

      // Should have exactly one warning issue
      expect(compilationResult.issues).toHaveLength(1);
      expect(compilationResult.issues[0]).toEqual({
        severity: "warning",
        message: "Accessing password field may not be secure",
      });

      // Program should still work normally
      const result = await compilationResult.program.eval({
        user: { password: "secret123" },
      });
      expect(result).toBe("secret123");

      // Test expression without warnings
      const cleanResult = await env.compileDetailed("user.name");
      expect(cleanResult.success).toBe(true);
      expect(cleanResult.issues).toHaveLength(0);

      compilationResult.program.destroy();
      cleanResult.program.destroy();
      env.destroy();
    });

    test("should handle multiple validators", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "data",
            type: { kind: "map", keyType: "string", valueType: "dyn" },
          },
        ],
        options: [
          Options.astValidators({
            validators: [
              // Validator 1: Check for password access
              (nodeType, nodeData, context) => {
                if (nodeType === "select" && nodeData.field === "password") {
                  return {
                    issues: [
                      {
                        severity: "warning",
                        message: "Password field access detected",
                      },
                    ],
                  };
                }
                return { issues: [] };
              },
              // Validator 2: Check for admin access
              (nodeType, nodeData, context) => {
                if (nodeType === "select" && nodeData.field === "admin") {
                  return {
                    issues: [
                      {
                        severity: "error",
                        message: "Admin field access not allowed",
                      },
                    ],
                  };
                }
                return { issues: [] };
              },
            ],
            options: {
              failOnWarning: false, // Don't fail compilation on warnings for this test
              includeWarnings: true,
            },
          }),
        ],
      });

      // Test normal field access (should work with no issues)
      const normalResult = await env.compileDetailed("data.name");
      expect(normalResult.success).toBe(true);
      expect(normalResult.issues).toHaveLength(0);

      const result1 = await normalResult.program.eval({
        data: { name: "John" },
      });
      expect(result1).toBe("John");

      // Test password field access (should work but trigger warning)
      const passwordResult = await env.compileDetailed("data.password");
      expect(passwordResult.success).toBe(true);
      expect(passwordResult.issues).toHaveLength(1);
      expect(passwordResult.issues[0]).toEqual({
        severity: "warning",
        message: "Password field access detected",
      });

      const result2 = await passwordResult.program.eval({
        data: { password: "secret" },
      });
      expect(result2).toBe("secret");

      // Test admin field access (should fail compilation due to error)
      const adminResult = await env.compileDetailed("data.admin");
      expect(adminResult.success).toBe(false); // Errors always cause compilation failure
      expect(adminResult.program).toBeUndefined();
      expect(adminResult.error).toMatch(/Admin field access not allowed/);
      expect(adminResult.issues).toHaveLength(1);
      expect(adminResult.issues[0]).toEqual({
        severity: "error",
        message: "Admin field access not allowed",
        location: { line: 1, column: 4 }, // CEL provides actual location info
      });

      normalResult.program.destroy();
      passwordResult.program.destroy();
      // adminResult.program is undefined because compilation failed
      env.destroy();
    });

    test("should extend environment with ASTValidators after creation", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "config",
            type: { kind: "map", keyType: "string", valueType: "string" },
          },
        ],
      });

      // Before extending, should have no validation issues
      const beforeResult = await env.compileDetailed("config.secret");
      expect(beforeResult.success).toBe(true);
      expect(beforeResult.issues).toHaveLength(0);

      await env.extend([
        Options.astValidators({
          validators: [
            (nodeType, nodeData, context) => {
              if (nodeType === "select" && nodeData.field === "secret") {
                return {
                  issues: [
                    {
                      severity: "warning",
                      message: "Secret field access detected",
                    },
                  ],
                };
              }
              return { issues: [] };
            },
          ],
          options: {
            failOnWarning: false, // Don't fail compilation on warnings
            includeWarnings: true,
          },
        }),
      ]);

      // After extending, should have validation warning
      const afterResult = await env.compileDetailed("config.secret");
      expect(afterResult.success).toBe(true);
      expect(afterResult.issues).toHaveLength(1);
      expect(afterResult.issues[0]).toEqual({
        severity: "warning",
        message: "Secret field access detected",
      });

      const result = await afterResult.program.eval({
        config: { secret: "hidden" },
      });
      expect(result).toBe("hidden");

      beforeResult.program.destroy();
      afterResult.program.destroy();
      env.destroy();
    });

    test("should handle validator with location information", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "obj",
            type: { kind: "map", keyType: "string", valueType: "int" },
          },
          { name: "increment", type: "int" },
        ],
        options: [
          Options.astValidators({
            validators: [
              (nodeType, nodeData, context) => {
                if (nodeType === "select" && nodeData.field === "deprecated") {
                  return {
                    issues: [
                      {
                        severity: "warning",
                        message:
                          "Field 'deprecated' is deprecated and should not be used",
                        location: nodeData.location, // Use actual location from AST
                      },
                    ],
                  };
                }
                return { issues: [] };
              },
            ],
            options: {
              failOnWarning: false,
              includeWarnings: true,
            },
          }),
        ],
      });

      const compilationResult = await env.compileDetailed(
        "obj.deprecated + increment",
      );

      // Compilation should succeed
      expect(compilationResult.success).toBe(true);
      expect(compilationResult.program).toBeDefined();

      // Should have exactly one warning with location information
      expect(compilationResult.issues).toHaveLength(1);
      expect(compilationResult.issues[0]).toEqual({
        severity: "warning",
        message: "Field 'deprecated' is deprecated and should not be used",
        location: {
          line: 1,
          column: 4,
        },
      });

      const result = await compilationResult.program.eval({
        obj: { deprecated: 42 },
        increment: 1,
      });
      expect(result).toBe(43);

      compilationResult.program.destroy();
      env.destroy();
    });

    test("should provide accurate location information from AST", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "user",
            type: { kind: "map", keyType: "string", valueType: "string" },
          },
        ],
        options: [
          Options.astValidators({
            validators: [
              (nodeType, nodeData, context) => {
                // Validate that location information is available in nodeData
                if (nodeType === "select" && nodeData.field === "name") {
                  // Verify that location information is present
                  expect(nodeData.location).toBeDefined();
                  expect(nodeData.location.line).toBe(1);
                  expect(nodeData.location.column).toBeGreaterThan(0);

                  return {
                    issues: [
                      {
                        severity: "info",
                        message: `Field access at line ${nodeData.location.line}, column ${nodeData.location.column}`,
                        location: nodeData.location,
                      },
                    ],
                  };
                }
                return { issues: [] };
              },
            ],
            options: {
              failOnWarning: false,
              includeWarnings: true,
            },
          }),
        ],
      });

      const compilationResult = await env.compileDetailed("user.name");

      // Compilation should succeed
      expect(compilationResult.success).toBe(true);
      expect(compilationResult.program).toBeDefined();

      // Should have exactly one info issue with location information
      expect(compilationResult.issues).toHaveLength(1);
      expect(compilationResult.issues[0].severity).toBe("info");
      expect(compilationResult.issues[0].message).toMatch(
        /Field access at line 1, column \d+/,
      );
      expect(compilationResult.issues[0].location).toBeDefined();
      expect(compilationResult.issues[0].location.line).toBe(1);
      expect(compilationResult.issues[0].location.column).toBeGreaterThan(0);

      compilationResult.program.destroy();
      env.destroy();
    });

    test("should handle validator that accesses context data", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "request",
            type: { kind: "map", keyType: "string", valueType: "string" },
          },
        ],
        options: [
          Options.astValidators({
            validators: [
              (nodeType, nodeData, context) => {
                // Test context properties
                const source = context.source;
                const contextData = context.contextData;

                if (nodeType === "select" && nodeData.field === "method") {
                  return {
                    issues: [
                      {
                        severity: "info",
                        message: `HTTP method access in expression: ${source}`,
                      },
                    ],
                  };
                }
                return { issues: [] };
              },
            ],
            options: {
              failOnWarning: false, // Don't fail compilation on warnings/info messages
              includeWarnings: true,
            },
          }),
        ],
      });

      const compilationResult = await env.compileDetailed(
        'request.method == "POST"',
      );

      // Compilation should succeed
      expect(compilationResult.success).toBe(true);
      expect(compilationResult.program).toBeDefined();

      // Should have exactly one info issue with context information
      expect(compilationResult.issues).toHaveLength(1);
      expect(compilationResult.issues[0]).toEqual({
        severity: "info",
        message: "HTTP method access in expression: <expression>", // Context source is available
      });

      const result = await compilationResult.program.eval({
        request: { method: "POST" },
      });
      expect(result).toBe(true);

      compilationResult.program.destroy();
      env.destroy();
    });

    test("should handle empty validators array", async () => {
      const env = await Env.new({
        variables: [
          { name: "x", type: "int" },
          { name: "y", type: "int" },
        ],
        options: [
          Options.astValidators({
            validators: [],
          }),
        ],
      });

      const program = await env.compile("x + y");
      const result = await program.eval({ x: 5, y: 1 });
      expect(result).toBe(6);

      program.destroy();
      env.destroy();
    });

    test("should handle validator configuration options", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "data",
            type: { kind: "map", keyType: "string", valueType: "string" },
          },
        ],
        options: [
          Options.astValidators({
            validators: [
              (nodeType, nodeData, context) => {
                // Return a warning for any literal value (to test configuration)
                if (
                  nodeType === "literal" &&
                  typeof nodeData.value === "string"
                ) {
                  return {
                    issues: [
                      {
                        severity: "warning",
                        message: "String literal detected",
                      },
                    ],
                  };
                }
                return { issues: [] };
              },
            ],
            options: {
              failOnWarning: false, // Warnings shouldn't fail compilation
              includeWarnings: false, // Warnings shouldn't be included in results
            },
          }),
        ],
      });

      // This should compile successfully even though there's a warning, because:
      // 1. failOnWarning: false means warnings don't cause compilation failure
      // 2. includeWarnings: false means warnings aren't collected
      const program = await env.compile('data.field == "allowed"');
      const result = await program.eval({ data: { field: "allowed" } });
      expect(result).toBe(true);

      // Test that an actual error still causes failure regardless of failOnWarning setting
      const envWithError = await Env.new({
        variables: [
          {
            name: "data",
            type: { kind: "map", keyType: "string", valueType: "string" },
          },
        ],
        options: [
          Options.astValidators({
            validators: [
              (nodeType, nodeData, context) => {
                if (nodeType === "literal" && nodeData.value === "forbidden") {
                  return {
                    issues: [
                      {
                        severity: "error", // This should ALWAYS cause failure
                        message: "Forbidden literal value",
                      },
                    ],
                  };
                }
                return { issues: [] };
              },
            ],
            options: {
              failOnWarning: false, // This shouldn't matter for errors
              includeWarnings: false,
            },
          }),
        ],
      });

      // This should fail because errors always cause compilation failure
      await expect(
        envWithError.compile('data.field == "forbidden"'),
      ).rejects.toThrow(/Forbidden literal value/);

      program.destroy();
      env.destroy();
      envWithError.destroy();
    });

    test("should fail compilation when validator reports errors with failOnWarning: true", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "user",
            type: { kind: "map", keyType: "string", valueType: "string" },
          },
        ],
        options: [
          Options.astValidators({
            validators: [
              (nodeType, nodeData, context) => {
                // Forbid access to sensitive fields
                if (nodeType === "select" && nodeData.field === "password") {
                  return {
                    issues: [
                      {
                        severity: "error",
                        message:
                          "Access to password field is forbidden for security reasons",
                      },
                    ],
                  };
                }
                return { issues: [] };
              },
            ],
            options: {
              failOnWarning: true, // This should cause warnings to fail compilation
              includeWarnings: true,
            },
          }),
        ],
      });

      // Test with compile() - should fail compilation due to the validator error
      await expect(env.compile("user.password")).rejects.toThrow(
        /Access to password field is forbidden for security reasons/,
      );

      // Test with compileDetailed() - should return failure with error details
      const compilationResult = await env.compileDetailed("user.password");
      expect(compilationResult.success).toBe(false);
      expect(compilationResult.program).toBeUndefined();
      expect(compilationResult.error).toMatch(
        /Access to password field is forbidden for security reasons/,
      );
      expect(compilationResult.issues).toHaveLength(1);
      expect(compilationResult.issues[0]).toEqual({
        severity: "error",
        message: "Access to password field is forbidden for security reasons",
        location: { line: 1, column: 4 }, // CEL provides location info
      });

      env.destroy();
    });

    test("should allow compilation when validator reports warnings with failOnWarning: false", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "user",
            type: { kind: "map", keyType: "string", valueType: "string" },
          },
        ],
        options: [
          Options.astValidators({
            validators: [
              (nodeType, nodeData, context) => {
                // Warn about deprecated fields but don't fail compilation
                if (nodeType === "select" && nodeData.field === "oldField") {
                  return {
                    issues: [
                      {
                        severity: "warning",
                        message:
                          "Field 'oldField' is deprecated and will be removed in future versions",
                      },
                    ],
                  };
                }
                return { issues: [] };
              },
            ],
            options: {
              failOnWarning: false, // Warnings shouldn't fail compilation
              includeWarnings: true,
            },
          }),
        ],
      });

      // Test with compile() - should succeed despite the warning
      const program = await env.compile("user.oldField");
      const result = await program.eval({ user: { oldField: "legacy_value" } });
      expect(result).toBe("legacy_value");

      // Test with compileDetailed() - should succeed and expose the warning
      const compilationResult = await env.compileDetailed("user.oldField");
      expect(compilationResult.success).toBe(true);
      expect(compilationResult.program).toBeDefined();
      expect(compilationResult.error).toBeUndefined();
      expect(compilationResult.issues).toHaveLength(1);
      expect(compilationResult.issues[0]).toEqual({
        severity: "warning",
        message:
          "Field 'oldField' is deprecated and will be removed in future versions",
      });

      program.destroy();
      compilationResult.program.destroy();
      env.destroy();
    });

    test("should fail compilation when validator reports warnings with failOnWarning: true", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "config",
            type: { kind: "map", keyType: "string", valueType: "string" },
          },
        ],
        options: [
          Options.astValidators({
            validators: [
              (nodeType, nodeData, context) => {
                // Even warnings should fail compilation when failOnError is true
                if (
                  nodeType === "select" &&
                  nodeData.field === "experimental"
                ) {
                  return {
                    issues: [
                      {
                        severity: "warning",
                        message:
                          "Use of experimental features is not recommended",
                      },
                    ],
                  };
                }
                return { issues: [] };
              },
            ],
            options: {
              failOnWarning: true, // Warnings should fail compilation
              includeWarnings: true,
            },
          }),
        ],
      });

      // Test with compile() - should fail compilation even though it's just a warning
      await expect(env.compile("config.experimental")).rejects.toThrow(
        /Use of experimental features is not recommended/,
      );

      // Test with compileDetailed() - should return failure with both CEL error and original warning
      const compilationResult = await env.compileDetailed(
        "config.experimental",
      );
      expect(compilationResult.success).toBe(false);
      expect(compilationResult.program).toBeUndefined();
      expect(compilationResult.error).toMatch(
        /Use of experimental features is not recommended/,
      );
      expect(compilationResult.issues).toHaveLength(2);

      // Should have both the CEL error (from failOnWarning conversion) and original warning
      const celError = compilationResult.issues.find(
        (issue) => issue.severity === "error",
      );
      const originalWarning = compilationResult.issues.find(
        (issue) => issue.severity === "warning",
      );

      expect(celError).toEqual({
        severity: "error", // Converted to error by CEL when failOnWarning: true
        message: "Use of experimental features is not recommended",
        location: { line: 1, column: 6 }, // CEL provides location info
      });

      expect(originalWarning).toEqual({
        severity: "warning", // Original severity preserved
        message: "Use of experimental features is not recommended",
        // Note: Original warning from custom collector may not have location info
      });

      env.destroy();
    });

    test("should properly expose all validator issues through compileDetailed", async () => {
      const env = await Env.new({
        variables: [
          {
            name: "user",
            type: { kind: "map", keyType: "string", valueType: "dyn" },
          },
          {
            name: "admin",
            type: { kind: "map", keyType: "string", valueType: "dyn" },
          },
        ],
        options: [
          Options.astValidators({
            validators: [
              // Validator 1: Security warnings
              (nodeType, nodeData, context) => {
                if (nodeType === "select" && nodeData.field === "password") {
                  return {
                    issues: [
                      {
                        severity: "warning",
                        message: "Password field access detected",
                        location: { line: 1, column: 5 },
                      },
                    ],
                  };
                }
                return { issues: [] };
              },
              // Validator 2: Deprecated field warnings
              (nodeType, nodeData, context) => {
                if (nodeType === "select" && nodeData.field === "deprecated") {
                  return {
                    issues: [
                      {
                        severity: "info",
                        message: "This field is deprecated",
                      },
                    ],
                  };
                }
                return { issues: [] };
              },
              // Validator 3: Admin access errors
              (nodeType, nodeData, context) => {
                if (nodeType === "select" && nodeData.field === "adminToken") {
                  return {
                    issues: [
                      {
                        severity: "error",
                        message: "Admin token access forbidden",
                        location: { line: 1, column: 10 },
                      },
                    ],
                  };
                }
                return { issues: [] };
              },
            ],
            options: {
              failOnWarning: false, // Allow compilation to succeed for testing
              includeWarnings: true,
            },
          }),
        ],
      });

      // Test expression with warnings and info (no errors)
      const multiIssueResult = await env.compileDetailed(
        "user.password && user.deprecated",
      );

      expect(multiIssueResult.success).toBe(true); // Should succeed because no errors
      expect(multiIssueResult.program).toBeDefined();
      expect(multiIssueResult.error).toBeUndefined();

      // Should have exactly 2 issues (warning and info)
      expect(multiIssueResult.issues).toHaveLength(2);

      // Verify each issue is properly reported
      const issues = multiIssueResult.issues;

      // Find each issue by message (order may vary)
      const passwordIssue = issues.find(
        (i) => i.message === "Password field access detected",
      );
      const deprecatedIssue = issues.find(
        (i) => i.message === "This field is deprecated",
      );

      expect(passwordIssue).toEqual({
        severity: "warning",
        message: "Password field access detected",
        location: { line: 1, column: 5 },
      });

      expect(deprecatedIssue).toEqual({
        severity: "info",
        message: "This field is deprecated",
      });

      // Test expression with error (should fail)
      const errorResult = await env.compileDetailed("admin.adminToken");
      expect(errorResult.success).toBe(false);
      expect(errorResult.program).toBeUndefined();
      expect(errorResult.error).toMatch(/Admin token access forbidden/);
      expect(errorResult.issues).toHaveLength(1);
      expect(errorResult.issues[0]).toEqual({
        severity: "error",
        message: "Admin token access forbidden (line 1, col 10)", // CEL includes location in message
        location: { line: 1, column: 5 }, // CEL provides actual location info
      });

      // Test expression with no issues
      const cleanResult = await env.compileDetailed("user.name");
      expect(cleanResult.success).toBe(true);
      expect(cleanResult.issues).toHaveLength(0);

      // Test parallel compilations to ensure proper isolation
      const parallelResults = await Promise.all([
        env.compileDetailed("user.password"), // Should have 1 warning
        env.compileDetailed("user.deprecated"), // Should have 1 info
        env.compileDetailed("admin.adminToken"), // Should have 1 error (fail)
        env.compileDetailed("user.name"), // Should have 0 issues
      ]);

      expect(parallelResults[0].success).toBe(true);
      expect(parallelResults[0].issues).toHaveLength(1);
      expect(parallelResults[0].issues[0].severity).toBe("warning");

      expect(parallelResults[1].success).toBe(true);
      expect(parallelResults[1].issues).toHaveLength(1);
      expect(parallelResults[1].issues[0].severity).toBe("info");

      expect(parallelResults[2].success).toBe(false); // Error causes failure
      expect(parallelResults[2].issues).toHaveLength(1);
      expect(parallelResults[2].issues[0].severity).toBe("error");

      expect(parallelResults[3].success).toBe(true);
      expect(parallelResults[3].issues).toHaveLength(0);

      // Clean up all programs (skip failed compilations)
      multiIssueResult.program.destroy();
      cleanResult.program.destroy();
      parallelResults.forEach((result) => result.program?.destroy());
      env.destroy();
    });
  });

  describe("CrossTypeNumericComparisons option", () => {
    test("should create environment with CrossTypeNumericComparisons during construction", async () => {
      const env = await Env.new({
        variables: [
          { name: "intValue", type: "int" },
          { name: "doubleValue", type: "double" },
        ],
        options: [Options.crossTypeNumericComparisons()],
      });

      // Test double > int comparison
      const program1 = await env.compile("doubleValue > intValue");
      const result1 = await program1.eval({ doubleValue: 3.14, intValue: 3 });
      expect(result1).toBe(true);

      // Test int < double comparison
      const program2 = await env.compile("intValue < doubleValue");
      const result2 = await program2.eval({ intValue: 3, doubleValue: 3.14 });
      expect(result2).toBe(true);

      // Test double <= int comparison
      const program3 = await env.compile("doubleValue <= intValue");
      const result3 = await program3.eval({ doubleValue: 1.5, intValue: 2 });
      expect(result3).toBe(true);

      program1.destroy();
      program2.destroy();
      program3.destroy();
      env.destroy();
    });

    test("should handle explicit enabled configuration", async () => {
      const env = await Env.new({
        variables: [
          { name: "intValue", type: "int" },
          { name: "doubleValue", type: "double" },
        ],
        options: [Options.crossTypeNumericComparisons({ enabled: true })],
      });

      const program = await env.compile("doubleValue < intValue");
      const result = await program.eval({ doubleValue: 2.5, intValue: 3 });
      expect(result).toBe(true);

      program.destroy();
      env.destroy();
    });

    test("should disable cross-type comparisons when enabled: false", async () => {
      const env = await Env.new({
        variables: [
          { name: "intValue", type: "int" },
          { name: "doubleValue", type: "double" },
        ],
        options: [Options.crossTypeNumericComparisons({ enabled: false })],
      });

      // This should fail at compile time because cross-type comparisons are disabled
      await expect(env.compile("doubleValue > intValue")).rejects.toThrow();

      env.destroy();
    });

    test("should extend environment with CrossTypeNumericComparisons after creation", async () => {
      const env = await Env.new({
        variables: [
          { name: "intValue", type: "int" },
          { name: "doubleValue", type: "double" },
        ],
      });

      // Before extending, cross-type comparisons should fail
      await expect(env.compile("doubleValue > intValue")).rejects.toThrow();

      await env.extend([Options.crossTypeNumericComparisons()]);

      // After extending, cross-type comparisons should work
      const program = await env.compile("doubleValue > intValue");
      const result = await program.eval({ doubleValue: 3.14, intValue: 3 });
      expect(result).toBe(true);

      program.destroy();
      env.destroy();
    });

    test("should work with various numeric comparison operations", async () => {
      const env = await Env.new({
        variables: [
          { name: "intValue", type: "int" },
          { name: "doubleValue", type: "double" },
          { name: "uintValue", type: "uint" },
        ],
        options: [Options.crossTypeNumericComparisons()],
      });

      // Test all supported comparison operators (CrossTypeNumericComparisons only supports ordering operators, not equality)
      const tests = [
        {
          expr: "doubleValue > intValue",
          vars: { doubleValue: 42.1, intValue: 42, uintValue: 1 },
          expected: true,
        },
        {
          expr: "doubleValue >= intValue",
          vars: { doubleValue: 42.0, intValue: 42, uintValue: 1 },
          expected: true,
        },
        {
          expr: "doubleValue < intValue",
          vars: { doubleValue: 41.9, intValue: 42, uintValue: 1 },
          expected: true,
        },
        {
          expr: "doubleValue <= intValue",
          vars: { doubleValue: 42.0, intValue: 42, uintValue: 1 },
          expected: true,
        },
        {
          expr: "intValue > uintValue",
          vars: { doubleValue: 1.0, intValue: 42, uintValue: 41 },
          expected: true,
        },
        {
          expr: "uintValue < doubleValue",
          vars: { doubleValue: 42.1, intValue: 1, uintValue: 42 },
          expected: true,
        },
        {
          expr: "intValue >= doubleValue",
          vars: { doubleValue: 41.9, intValue: 42, uintValue: 1 },
          expected: true,
        },
        {
          expr: "uintValue <= intValue",
          vars: { doubleValue: 1.0, intValue: 42, uintValue: 41 },
          expected: true,
        },
      ];

      for (const test of tests) {
        const program = await env.compile(test.expr);
        const result = await program.eval(test.vars);
        expect(result).toBe(test.expected);
        program.destroy();
      }

      env.destroy();
    });

    test("should handle edge cases with zero and negative numbers", async () => {
      const env = await Env.new({
        variables: [
          { name: "intValue", type: "int" },
          { name: "doubleValue", type: "double" },
        ],
        options: [Options.crossTypeNumericComparisons()],
      });

      // Test with zero values
      const program1 = await env.compile(
        "intValue <= doubleValue && doubleValue <= intValue",
      );
      const result1 = await program1.eval({ intValue: 0, doubleValue: 0.0 });
      expect(result1).toBe(true);

      // Test with negative numbers
      const program2 = await env.compile("intValue > doubleValue");
      const result2 = await program2.eval({ intValue: -1, doubleValue: -1.5 });
      expect(result2).toBe(true);

      // Test with mixed positive/negative
      const program3 = await env.compile("doubleValue > intValue");
      const result3 = await program3.eval({ doubleValue: 0.1, intValue: -1 });
      expect(result3).toBe(true);

      program1.destroy();
      program2.destroy();
      program3.destroy();
      env.destroy();
    });

    test("should work with complex expressions involving cross-type comparisons", async () => {
      const env = await Env.new({
        variables: [
          { name: "intValue", type: "int" },
          { name: "doubleValue", type: "double" },
          { name: "threshold", type: "double" },
        ],
        options: [Options.crossTypeNumericComparisons()],
      });

      // Complex expression with multiple cross-type comparisons
      const program = await env.compile(
        "intValue > 0 && doubleValue >= threshold && intValue < (doubleValue + doubleValue)",
      );

      const result = await program.eval({
        intValue: 5,
        doubleValue: 3.0,
        threshold: 2.5,
      });
      expect(result).toBe(true);

      program.destroy();
      env.destroy();
    });

    test("should produce same results for options during creation vs extend", async () => {
      // Environment with option during creation
      const env1 = await Env.new({
        variables: [
          { name: "intValue", type: "int" },
          { name: "doubleValue", type: "double" },
        ],
        options: [Options.crossTypeNumericComparisons()],
      });

      // Environment with option added via extend
      const env2 = await Env.new({
        variables: [
          { name: "intValue", type: "int" },
          { name: "doubleValue", type: "double" },
        ],
      });
      await env2.extend([Options.crossTypeNumericComparisons()]);

      const expression =
        "doubleValue > intValue && intValue >= (doubleValue - 0.15) && intValue <= (doubleValue - 0.13)";
      const variables = { intValue: 3, doubleValue: 3.14 };

      const program1 = await env1.compile(expression);
      const program2 = await env2.compile(expression);

      const result1 = await program1.eval(variables);
      const result2 = await program2.eval(variables);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result1).toBe(result2);

      program1.destroy();
      program2.destroy();
      env1.destroy();
      env2.destroy();
    });
  });
});
