// Code-execution tool for the agent loop (ADR-002).
// The agent writes files to its run workspace; `run_command` materialises them in a fresh temp
// directory, runs ONE allow-listed executable (argv, never a shell), and syncs changed text files back.
//
// Isolation (LocalProcessSandbox) is best-effort and meant for a DEDICATED worker host, never the web service:
//   - no shell, allow-listed executables only, argv passed verbatim
//   - scrubbed environment (no API keys / DB credentials reach the code)
//   - fresh temp dir per call, HOME inside it, removed afterwards
//   - wall-clock timeout with process-group kill, output cap, prlimit (memory / processes / file size) when available
//   - optional network cut-off via `unshare -n` when AGENT_SANDBOX_NETWORK=off and the host permits it
// Enable with AGENT_SANDBOX=local. A remote sandbox (container/microVM) can implement the same interface later.
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import type { AgentTool, ToolResult } from "@/lib/agent-loop/contracts";

export type SandboxRequest = { command: string; args: string[]; files: Record<string, string>; timeoutMs: number; network: boolean };
export type SandboxResult = {
  exitCode: number | null; timedOut: boolean; durationMs: number;
  stdout: string; stderr: string; changedFiles: Record<string, string>;
  isolation: { networkDisabled: boolean; limits: boolean };
};
export interface CodeSandbox { run(request: SandboxRequest): Promise<SandboxResult> }

export const ALLOWED_COMMANDS = ["python3", "python", "pytest", "node", "npm", "npx", "tsc", "go", "cargo"] as const;
const SKIP_DIRS = new Set(["node_modules", ".venv", "venv", "__pycache__", ".pytest_cache", ".git", "dist", "build", ".next", "target"]);
const MAX_OUTPUT = 12_000;
const MAX_SYNC_FILE = 200_000;
const MAX_SYNC_FILES = 200;

function tail(s: string) { return s.length > MAX_OUTPUT ? "…[truncated " + (s.length - MAX_OUTPUT) + " chars]\n" + s.slice(-MAX_OUTPUT) : s; }

const IS_WINDOWS = process.platform === "win32";

/** Minimal environment: nothing from the parent except what interpreters need to start (no secrets). */
export function sandboxEnv(dir: string, parent: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { PATH: parent.PATH || parent.Path || "/usr/local/bin:/usr/bin:/bin", HOME: dir, LANG: "C.UTF-8", PYTHONDONTWRITEBYTECODE: "1", PYTHONIOENCODING: "utf-8", CI: "1", npm_config_cache: join(dir, ".npm-cache"), NODE_ENV: "test" };
  if (IS_WINDOWS) {
    // Windows interpreters fail to start without these; they carry no credentials.
    for (const k of ["SystemRoot", "SYSTEMROOT", "WINDIR", "PATHEXT", "COMSPEC"]) if (parent[k]) env[k] = parent[k];
    Object.assign(env, { USERPROFILE: dir, TEMP: dir, TMP: dir, APPDATA: join(dir, "AppData"), LOCALAPPDATA: join(dir, "AppData") });
  }
  return env;
}

/** Kills the whole process tree: negative pid (process group) on POSIX, taskkill /T on Windows. */
function killTree(pid: number | undefined) {
  if (!pid) return;
  try {
    if (IS_WINDOWS) spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", timeout: 5000 });
    else process.kill(-pid, "SIGKILL");
  } catch { /* already gone */ }
}

function capability(cmd: string, args: string[]) {
  try { return spawnSync(cmd, args, { timeout: 3000, stdio: "ignore" }).status === 0; } catch { return false; }
}

export class LocalProcessSandbox implements CodeSandbox {
  private readonly canUnshare: boolean;
  private readonly canPrlimit: boolean;
  constructor() {
    this.canUnshare = process.platform === "linux" && capability("unshare", ["-n", "true"]);
    this.canPrlimit = process.platform === "linux" && capability("prlimit", ["--as=1073741824", "true"]);
  }

  async run(request: SandboxRequest): Promise<SandboxResult> {
    if (!(ALLOWED_COMMANDS as readonly string[]).includes(request.command)) throw new Error("COMMAND_NOT_ALLOWED:" + request.command);
    const dir = await mkdtemp(join(tmpdir(), "agent-sbx-"));
    try {
      for (const [path, content] of Object.entries(request.files)) {
        const target = join(dir, path);
        if (relative(dir, target).startsWith("..")) continue;
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content);
      }
      const before = new Map(Object.entries(request.files));
      const isolateNet = !request.network && this.canUnshare;
      const limits = this.canPrlimit ? ["prlimit", "--as=2147483648", "--nproc=256", "--fsize=52428800", "--"] : [];
      const argv = [...(isolateNet ? ["unshare", "-n", "--"] : []), ...limits, request.command, ...request.args];
      // npm/npx/tsc are .cmd shims on Windows and only start through cmd.exe. Arguments are then
      // restricted to characters cmd.exe treats literally, so the allow-list cannot be bypassed.
      const viaShell = IS_WINDOWS && ["npm", "npx", "tsc"].includes(request.command);
      if (viaShell && request.args.some((a) => /[&|<>^%"!\r\n]/.test(a))) throw new Error("COMMAND_ARGS_UNSAFE_ON_WINDOWS");
      const spawnCmd = viaShell ? [argv[0], ...argv.slice(1).map((a) => (/\s/.test(a) ? `"${a}"` : a))].join(" ") : argv[0];
      const spawnArgs = viaShell ? [] : argv.slice(1);
      const started = Date.now();
      const { exitCode, timedOut, stdout, stderr } = await new Promise<{ exitCode: number | null; timedOut: boolean; stdout: string; stderr: string }>((resolve) => {
        const child = spawn(spawnCmd, spawnArgs, {
          // POSIX: own process group so the timeout can kill grandchildren. Windows: detached would open a console.
          cwd: dir, detached: !IS_WINDOWS, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
          shell: viaShell,
          env: sandboxEnv(dir),
        });
        let out = "", err = "", timedOut = false;
        child.stdout.on("data", (d: Buffer) => { out = (out + d).slice(-MAX_OUTPUT * 2); });
        child.stderr.on("data", (d: Buffer) => { err = (err + d).slice(-MAX_OUTPUT * 2); });
        const timer = setTimeout(() => { timedOut = true; killTree(child.pid); }, request.timeoutMs);
        child.on("error", (e) => { clearTimeout(timer); resolve({ exitCode: null, timedOut, stdout: out, stderr: err + String(e) }); });
        child.on("close", (code) => { clearTimeout(timer); resolve({ exitCode: code, timedOut, stdout: out, stderr: err }); });
      });
      const changedFiles: Record<string, string> = {};
      const walk = async (d: string) => {
        for (const name of await readdir(d)) {
          if (Object.keys(changedFiles).length >= MAX_SYNC_FILES) return;
          const p = join(d, name);
          const s = await stat(p);
          if (s.isDirectory()) { if (!SKIP_DIRS.has(name) && !name.startsWith(".")) await walk(p); continue; }
          if (s.size > MAX_SYNC_FILE) continue;
          const rel = relative(dir, p).replace(/\\/g, "/");
          const buf = await readFile(p);
          if (buf.includes(0)) continue; // binary
          const text = buf.toString("utf8");
          if (before.get(rel) !== text) changedFiles[rel] = text;
        }
      };
      await walk(dir);
      return { exitCode, timedOut, durationMs: Date.now() - started, stdout: tail(stdout), stderr: tail(stderr), changedFiles, isolation: { networkDisabled: isolateNet, limits: this.canPrlimit } };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export function createRunCommandTool(sandbox: CodeSandbox, options: { network?: boolean; maxTimeoutMs?: number } = {}): AgentTool {
  const maxTimeout = options.maxTimeoutMs ?? 300_000;
  return {
    name: "run_command",
    description: `Run one command against the workspace files in an isolated temp directory and get exit code + output. Allowed executables: ${ALLOWED_COMMANDS.join(", ")} (args as an array, no shell syntax). Files created or modified by the command are synced back to the workspace. Use it to run tests and fix failures until they pass.${options.network === false ? " Network access is disabled." : ""}`,
    parameters: {
      type: "object",
      properties: { command: { type: "string", enum: [...ALLOWED_COMMANDS] }, args: { type: "array", items: { type: "string" } }, timeoutSec: { type: "integer", minimum: 1, maximum: Math.floor(maxTimeout / 1000) } },
      required: ["command", "args"], additionalProperties: false,
    },
    sideEffect: false,
    async execute(args, { run }): Promise<ToolResult> {
      const command = String(args.command || "");
      const argv = Array.isArray(args.args) ? args.args.map(String).slice(0, 50) : [];
      const timeoutMs = Math.min(maxTimeout, Math.max(1000, (Number(args.timeoutSec) || 60) * 1000));
      const result = await sandbox.run({ command, args: argv, files: run.workspace, timeoutMs, network: options.network !== false });
      const synced = Object.keys(result.changedFiles);
      return {
        status: "EXECUTED", // the tool ran; a non-zero exit code is information for the model, not a tool failure
        output: { exitCode: result.exitCode, timedOut: result.timedOut, durationMs: result.durationMs, stdout: result.stdout, stderr: result.stderr, syncedFiles: synced, isolation: result.isolation },
        workspaceWrites: result.changedFiles,
      };
    },
  };
}

/** Returns the run_command tool when AGENT_SANDBOX=local, otherwise null (feature off by default). */
export function sandboxToolFromEnv(env: Record<string, string | undefined> = process.env): AgentTool | null {
  if (env.AGENT_SANDBOX !== "local") return null;
  return createRunCommandTool(new LocalProcessSandbox(), { network: env.AGENT_SANDBOX_NETWORK !== "off", maxTimeoutMs: Number(env.AGENT_SANDBOX_MAX_TIMEOUT_MS) || 300_000 });
}
