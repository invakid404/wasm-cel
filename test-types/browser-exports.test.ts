import {
  CELFunction,
  Env,
  Options,
  optionalType,
  type CELOptionalType,
  type EnvExtensions,
  type OptionalTypesExt,
} from "../dist/browser.js";

declare function expectType<T>(value: T): void;

type AssertExtendsTuple<T extends [OptionalTypesExt]> = T;

const optionalString: CELOptionalType<"string"> = optionalType("string");

expectType<CELOptionalType<"string">>(optionalString);

const envWithOptionalTypes = await Env.new({
  options: [Options.optionalTypes()] as const,
  variables: [
    {
      name: "maybeName",
      type: optionalString,
    },
  ],
});

type BrowserOptionalExtensions = AssertExtendsTuple<
  EnvExtensions<typeof envWithOptionalTypes>
>;

CELFunction.new<BrowserOptionalExtensions>("wrap")
  .param("value", optionalType("string"))
  .returns(optionalType("string"))
  .implement((value) => {
    expectType<string | null>(value);
    return value;
  });
