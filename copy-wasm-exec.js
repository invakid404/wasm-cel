#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  const goroot = execSync('go env GOROOT', { encoding: 'utf-8' }).trim();
  
  const paths = [
    path.join(goroot, 'misc', 'wasm', 'wasm_exec.js'),
    path.join(goroot, 'lib', 'wasm', 'wasm_exec.js')
  ];
  
  for (const srcPath of paths) {
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, 'wasm_exec.js');
      console.log(`✓ wasm_exec.js copied successfully from ${path.relative(goroot, srcPath)}`);
      process.exit(0);
    }
  }
  
  console.error('⚠ Warning: wasm_exec.js not found in expected locations:');
  paths.forEach(p => console.error(`  - ${p}`));
  console.error('  Please copy it manually from your Go installation.');
  process.exit(1);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
