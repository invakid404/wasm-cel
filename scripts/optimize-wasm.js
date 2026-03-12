#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const args = [
  "-Oz",
  "--enable-bulk-memory",
  "--enable-sign-ext",
  "--enable-nontrapping-float-to-int",
  "--strip-producers",
  "--strip-target-features",
  "main.wasm",
  "-o",
  "main.wasm",
];

const helpText = execFileSync("wasm-opt", ["--help"], {
  encoding: "utf-8",
});

if (helpText.includes("--enable-bulk-memory-opt")) {
  args.splice(2, 0, "--enable-bulk-memory-opt");
}

execFileSync("wasm-opt", args, { stdio: "inherit" });
