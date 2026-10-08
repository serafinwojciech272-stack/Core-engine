#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const steps = [
  ["typecheck", "npm", ["run", "typecheck"]],
  ["lint", "npm", ["run", "lint"]],
  ["tests", "npm", ["test"]],
  ["official-tender-smoke", "node", ["--test", "--experimental-strip-types", "scripts/official-tender-smoke.ts"]],
  ["build", "npm", ["run", "build"]],
];

for (const [name, command, args] of steps) {
  console.log(`[CI] >>> ${name}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.error(`[CI] ${name} failed to start:`, result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[CI] ${name} failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
  console.log(`[CI] <<< ${name} OK`);
}

console.log("[CI] ALL CHECKS PASSED");
