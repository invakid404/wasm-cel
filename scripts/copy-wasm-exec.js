#!/usr/bin/env node

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const goroot = execSync("go env GOROOT", { encoding: "utf-8" }).trim();

  const paths = [
    path.join(goroot, "misc", "wasm", "wasm_exec.js"),
    path.join(goroot, "lib", "wasm", "wasm_exec.js"),
  ];

  for (const srcPath of paths) {
    if (fs.existsSync(srcPath)) {
      // Copy as .cjs so it's explicitly treated as CommonJS in ESM package
      const destPath = path.join(__dirname, "..", "wasm_exec.cjs");
      fs.copyFileSync(srcPath, destPath);
      console.log(
        `✓ wasm_exec.cjs copied successfully from ${path.relative(goroot, srcPath)}`,
      );
      process.exit(0);
    }
  }

  console.error("⚠ Warning: wasm_exec.js not found in expected locations:");
  paths.forEach((p) => console.error(`  - ${p}`));
  console.error("  Please copy it manually from your Go installation.");
  process.exit(1);
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
