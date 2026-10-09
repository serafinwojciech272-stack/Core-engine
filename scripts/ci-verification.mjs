#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createServer } from "node:http";

const cronMode = process.env.CI_GATE_MODE === "cron";
const port = Number(process.env.PORT || 3000);
const gateServer = cronMode
  ? null
  : createServer((req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ service: "core-engine-ci-gate", status: "verifying" }));
    });

if (gateServer) {
  await new Promise((resolve, reject) => {
    gateServer.once("error", reject);
    gateServer.listen(port, "0.0.0.0", resolve);
  });
  console.log(`[CI] gate server listening on 0.0.0.0:${port}`);
}

const steps = [
  ...(process.env.CI_GATE_MODE === "render" ? [] : [["typecheck", "npm", ["run", "typecheck"]]]),
  ["lint", "npm", ["run", "lint"]],
  ["tests", "npm", ["test"]],
  ...(process.env.CI_GATE_MODE === "render" ? [] : [["official-tender-smoke", "node", ["--test", "--experimental-strip-types", "scripts/official-tender-smoke.ts"]]]),
  ...(process.env.CI_GATE_MODE === "render" ? [] : [["build", "npm", ["run", "build"]]]),
];

const run = (name, command, args) =>
  new Promise((resolve) => {
    // Windows cannot spawn npm's .cmd shim directly. Route npm commands through
    // cmd.exe; keep native executable spawning on macOS/Linux and for node.
    const isWindowsNpm = process.platform === "win32" && command === "npm";
    const executable = isWindowsNpm ? (process.env.ComSpec || "cmd.exe") : command;
    const executableArgs = isWindowsNpm
      ? ["/d", "/s", "/c", `npm.cmd ${args.join(" ")}`]
      : args;

    const child = spawn(executable, executableArgs, {
      stdio: "inherit",
      env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=384" },
    });
    child.once("error", (error) => {
      console.error(`[CI] ${name} failed to start:`, error);
      resolve(1);
    });
    child.once("exit", (code, signal) => {
      if (signal) {
        console.error(`[CI] ${name} terminated by signal ${signal}`);
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });

try {
  for (const [name, command, args] of steps) {
    console.log(`[CI] >>> ${name}`);
    const exitCode = await run(name, command, args);
    if (exitCode !== 0) {
      console.error(`[CI] ${name} failed with exit code ${exitCode}`);
      process.exitCode = exitCode;
      break;
    }
    console.log(`[CI] <<< ${name} OK`);
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  }

  console.log("[CI] ALL CHECKS PASSED");
} finally {
  if (gateServer) {
    await new Promise((resolve) => gateServer.close(resolve));
  }
}
