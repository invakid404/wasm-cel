import {
  CELFunction,
  Env,
  Options,
  optionalType,
  type EnvExtensions,
} from "../dist/index.js";

declare function expectType<T>(value: T): void;

await Env.new({
  variables: [
    {
      name: "plain",
      type: "string",
    },
  ],
});

await Env.new({
  variables: [
    {
      name: "maybeName",
      // @ts-expect-error optional types require Options.optionalTypes()
      type: optionalType("string"),
    },
  ],
});

const envWithoutOptionalTypes = await Env.new();

CELFunction.new<typeof envWithoutOptionalTypes>("plain")
  .param("value", "string")
  .returns("string")
  .implement((value) => value);

CELFunction.new<typeof envWithoutOptionalTypes>("bad")
  // @ts-expect-error optional types require OptionalTypesExt in CELFunction extensions
  .param("value", optionalType("string"))
  .returns("string")
  .implement((value) => value ?? "fallback");

const envWithOptionalTypes = await Env.new({
  options: [Options.optionalTypes()] as const,
  variables: [
    {
      name: "maybeName",
      type: optionalType("string"),
    },
  ],
});

type OptionalExtensions = EnvExtensions<typeof envWithOptionalTypes>;

CELFunction.new<typeof envWithOptionalTypes>("wrap")
  .param("value", optionalType("string"))
  .returns(optionalType("string"))
  .implement((value) => {
    expectType<string | null>(value);
    return value;
  });

CELFunction.new<OptionalExtensions>("wrapFromExtensions")
  .param("value", optionalType("string"))
  .returns(optionalType("string"))
  .implement((value) => value);
