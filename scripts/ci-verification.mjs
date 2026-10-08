#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createServer } from "node:http";

const port = Number(process.env.PORT || 3000);
const gateServer = createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ service: "core-engine-ci-gate", status: "verifying" }));
});
gateServer.listen(port, "0.0.0.0");

const steps = [
  ...(process.env.PORT ? [] : [["typecheck", "npm", ["run", "typecheck"]]]),
  ["lint", "npm", ["run", "lint"]],
  ["tests", "npm", ["test"]],
  ["official-tender-smoke", "node", ["--test", "--experimental-strip-types", "scripts/official-tender-smoke.ts"]],
  ["build", "npm", ["run", "build"]],
];

for (const [name, command, args] of steps) {
  console.log(`[CI] >>> ${name}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=384" },
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

gateServer.close();
console.log("[CI] ALL CHECKS PASSED");
